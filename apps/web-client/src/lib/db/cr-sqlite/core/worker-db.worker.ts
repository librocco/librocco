/**
 * NOTE: This is a dedicated worker used to house the DB instance. We're using it to instantiate the DB
 * with a VFS that has to be run within the worker context (and, normally, wrap the worker in Comlink for easier interaction).
 * see: ./worker-db.ts
 *
 * When starting the worker, the name of the worker is expected to be of the format: "<dbname>---<vfs>"
 */

import * as Comlink from "comlink";

import { hexToBytes } from "@vlcn.io/ws-common";
import { createSyncedDB, defaultConfig, type Config } from "@vlcn.io/ws-client";

import type {
	DBAsync,
	OnUpdateCallback,
	StmtAsync,
	SyncProgressPayload,
	SyncStatusPayload,
	SyncTransportOptions,
	SyncWorkerBridge,
	TXCallback,
	VFSWhitelist,
	_TXAsync
} from "./types";

import type { DB as SyncDB } from "@vlcn.io/ws-client";

import { getCrsqliteDB } from "./init";
import { ConnectionEventEmitter, SyncEventEmitter, SyncTransportController, type SyncConfig } from "$lib/workers/sync-transport-control";

export type MsgInitOk = { _type: "wkr-init"; status: "ok" };
export type MsgWkrError = { _type: "wkr-init"; status: "error"; error: string; stack?: string };
export type MsgInit = MsgInitOk | MsgWkrError;

const MAX_SYNC_CHUNK_SIZE = 1024;

/**
 * Tuple shape returned by the sync changes query:
 * `table`, `pk`, `cid`, `val`, `col_version`, `db_version`, `NULL`, `cl`, `seq`.
 */
type ChangesetRow = [
	table: string,
	pk: Uint8Array,
	cid: string,
	val: unknown,
	colVersion: bigint,
	dbVersion: bigint,
	siteId: null,
	cl: bigint,
	seq: number
];

type ChangesetRowRaw = [
	table: string,
	pk: Uint8Array,
	cid: string,
	val: unknown,
	colVersion: number | bigint,
	dbVersion: number | bigint,
	siteId: null,
	cl: number | bigint,
	seq: number
];

const CHANGESET_COL_VERSION_INDEX = 4;
const CHANGESET_DB_VERSION_INDEX = 5;
const CHANGESET_CL_INDEX = 7;

async function start() {
	try {
		const [dbname, vfs] = self.name.split("---") as [string, VFSWhitelist];
		console.log(`[worker] initialising db, using: dbname: ${dbname}, vfs: ${vfs}`);
		if (!dbname || !vfs) {
			throw new Error("Invalid worker name format. Expected '<dbname>---<vfs>'.");
		}

		const _db = await getCrsqliteDB(dbname, vfs);
		console.log(`[worker] db initialised!`);

		const db = wrapDB(_db);
		Comlink.expose(db);

		console.log(`[worker] db exposed, sending ok msg...`);
		const msg: MsgInitOk = { _type: "wkr-init", status: "ok" };
		self.postMessage(msg);
	} catch (e) {
		const msg: MsgWkrError = { _type: "wkr-init", status: "error", error: (e as Error).message, stack: (e as Error).stack };
		self.postMessage(msg);
	}
}
start();

class SharedConnectionSyncDB implements SyncDB {
	readonly #db: DBAsync;
	readonly #pullChangesetStmt: StmtAsync;
	readonly #applyChangesetStmt: StmtAsync;
	readonly #updatePeerTrackerStmt: StmtAsync;
	readonly #schemaName: string;
	readonly #schemaVersion: bigint;
	readonly #changeListeners = new Set<() => void>();
	readonly #onUpdateDisposer: () => void;

	#applyingRemoteChanges = false;
	#closed = false;
	#closePromise: Promise<void> | null = null;

	constructor(
		db: DBAsync,
		public readonly siteid: Uint8Array,
		schemaName: string,
		schemaVersion: bigint,
		pullChangesetStmt: StmtAsync,
		applyChangesetStmt: StmtAsync,
		updatePeerTrackerStmt: StmtAsync
	) {
		this.#db = db;
		this.#schemaName = schemaName;
		this.#schemaVersion = schemaVersion;
		this.#pullChangesetStmt = pullChangesetStmt;
		this.#applyChangesetStmt = applyChangesetStmt;
		this.#updatePeerTrackerStmt = updatePeerTrackerStmt;
		this.#onUpdateDisposer = this.#db.onUpdate(() => {
			if (this.#closed || this.#applyingRemoteChanges) {
				return;
			}
			for (const listener of this.#changeListeners) {
				listener();
			}
		});
	}

	static async create(db: DBAsync): Promise<SharedConnectionSyncDB> {
		const [pullChangesetStmt, applyChangesetStmt, updatePeerTrackerStmt] = await Promise.all([
			db.prepare(
				`SELECT "table", "pk", "cid", "val", "col_version", "db_version", NULL, "cl", seq FROM crsql_changes WHERE db_version > ? AND site_id IS NOT ?`
			),
			db.prepare(
				`INSERT INTO crsql_changes ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			),
			db.prepare(`INSERT INTO "crsql_tracked_peers" ("site_id", "event", "version", "seq", "tag") VALUES (?, ?, ?, ?, 0) ON CONFLICT DO UPDATE SET
				"version" = MAX("version", excluded."version"),
				"seq" = CASE "version" > excluded."version" WHEN 1 THEN "seq" ELSE excluded."seq" END`)
		]);
		pullChangesetStmt.raw(true);

		const schemaNameRows = await db.execA<[string]>(`SELECT value FROM crsql_master WHERE key = 'schema_name'`);
		const schemaName = schemaNameRows[0]?.[0];
		if (schemaName == null) {
			throw new Error("The database does not have a schema applied.");
		}

		const schemaVersionRows = await db.execA<[number | bigint]>(`SELECT value FROM crsql_master WHERE key = 'schema_version'`);
		const schemaVersion = BigInt(schemaVersionRows[0]?.[0] ?? -1);

		return new SharedConnectionSyncDB(
			db,
			hexToBytes(db.siteid),
			schemaName,
			schemaVersion,
			pullChangesetStmt,
			applyChangesetStmt,
			updatePeerTrackerStmt
		);
	}

	async pullChangeset(since: readonly [bigint, number], excludeSites: readonly Uint8Array[], localOnly: boolean): Promise<ChangesetRow[]> {
		void localOnly;
		const rows = (await this.#pullChangesetStmt.all(null, since[0], excludeSites[0])) as ChangesetRowRaw[];
		for (const row of rows) {
			row[CHANGESET_COL_VERSION_INDEX] = BigInt(row[CHANGESET_COL_VERSION_INDEX]);
			row[CHANGESET_DB_VERSION_INDEX] = BigInt(row[CHANGESET_DB_VERSION_INDEX]);
			row[CHANGESET_CL_INDEX] = BigInt(row[CHANGESET_CL_INDEX]);
		}
		return rows as ChangesetRow[];
	}

	async applyChangesetAndSetLastSeen(changes: readonly ChangesetRow[], siteId: Uint8Array, end: readonly [bigint, number]): Promise<void> {
		this.#applyingRemoteChanges = true;
		try {
			await this.#db.tx(async (tx) => {
				for (const row of changes) {
					const [table, pk, cid, val, colVersion, dbVersion, , cl, seq] = row;
					await this.#applyChangesetStmt.run(tx, table, pk, cid, val, colVersion, dbVersion, siteId, cl, seq);
				}
				await this.#updatePeerTrackerStmt.run(tx, siteId, 0, end[0], end[1]);
			});
		} finally {
			this.#applyingRemoteChanges = false;
		}
	}

	async getLastSeens(): Promise<[Uint8Array, [bigint, number]][]> {
		const rows = await this.#db.execA<[Uint8Array, bigint | number, number]>(`SELECT site_id, version, seq FROM crsql_tracked_peers`);
		return rows.map((r) => [r[0], [BigInt(r[1]), r[2]]]);
	}

	async getSchemaNameAndVersion(): Promise<[string, bigint]> {
		return [this.#schemaName, this.#schemaVersion];
	}

	onChange(cb: () => void): () => void {
		this.#changeListeners.add(cb);
		return () => this.#changeListeners.delete(cb);
	}

	close(closeWrappedDB: boolean): Promise<void> {
		// Intentionally ignoring closeWrappedDB: in the shared-connection model the
		// sync runtime does not own the DB connection — the WrappedDB manages its
		// lifetime separately.
		void closeWrappedDB;
		if (this.#closePromise) return this.#closePromise;
		if (this.#closed) return Promise.resolve();
		this.#closed = true;
		this.#closePromise = (async () => {
			const finalizers = [
				["pullChangeset", this.#pullChangesetStmt.finalize(null)],
				["applyChangeset", this.#applyChangesetStmt.finalize(null)],
				["updatePeerTracker", this.#updatePeerTrackerStmt.finalize(null)]
			] as const;
			const finalizeErrors: unknown[] = [];
			try {
				const results = await Promise.allSettled(finalizers.map(([, promise]) => promise));
				for (const [idx, result] of results.entries()) {
					if (result.status === "rejected") {
						console.warn(`[worker] Failed to finalize ${finalizers[idx][0]} statement`, result.reason);
						finalizeErrors.push(result.reason);
					}
				}
			} finally {
				this.#onUpdateDisposer();
				this.#changeListeners.clear();
			}

			if (finalizeErrors.length > 0) {
				throw new AggregateError(finalizeErrors, "[worker] Failed to finalize sync statements");
			}
		})();
		return this.#closePromise;
	}
}

type SyncRuntimeHandle = { stop: () => Promise<void> };

async function createAndStartSyncedDBExclusive(
	config: Config,
	dbname: string,
	transportOptions: SyncTransportOptions
): Promise<SyncRuntimeHandle> {
	let releaser: (() => void) | null = null;
	const hold = new Promise<void>((resolve) => {
		releaser = resolve;
	});

	const startAndHold = async (): Promise<SyncRuntimeHandle> => {
		let sharedSyncDb: SharedConnectionSyncDB | null = null;
		const trackedConfig: Config = {
			...config,
			dbProvider: async (name) => {
				const db = await config.dbProvider(name);
				if (db instanceof SharedConnectionSyncDB) {
					sharedSyncDb = db;
				}
				return db;
			}
		};
		const syncedDb = await createSyncedDB(trackedConfig, dbname, transportOptions);
		const stopAndFinalize = async (): Promise<void> => {
			const stopErrors: unknown[] = [];
			try {
				await syncedDb.stop();
			} catch (err) {
				stopErrors.push(err);
			}
			if (sharedSyncDb) {
				try {
					await sharedSyncDb.close(false);
				} catch (err) {
					stopErrors.push(err);
				}
			}
			if (stopErrors.length > 1) {
				throw new AggregateError(stopErrors, "[worker] Failed to stop and finalize sync runtime");
			}
			if (stopErrors.length === 1) {
				throw stopErrors[0];
			}
		};
		try {
			await syncedDb.start();
		} catch (err) {
			try {
				await stopAndFinalize();
			} catch (stopErr) {
				console.warn(`[worker] Failed to stop sync runtime after start error for db '${dbname}'`, stopErr);
			}
			throw err;
		}
		return {
			stop: async () => {
				try {
					await stopAndFinalize();
				} finally {
					releaser?.();
				}
			}
		};
	};

	if (typeof navigator !== "undefined" && navigator?.locks) {
		return new Promise<SyncRuntimeHandle>((resolve, reject) => {
			navigator.locks.request(dbname, async () => {
				try {
					const handle = await startAndHold();
					resolve(handle);
					await hold;
				} catch (err) {
					reject(err);
				}
			});
		});
	}

	return startAndHold();
}

function wrapTransportProvider(
	provider: Config["transportProvider"],
	progressEmitter: SyncEventEmitter,
	connectionEmitter: ConnectionEventEmitter,
	config: SyncConfig
): Config["transportProvider"] {
	return (...params: Parameters<Config["transportProvider"]>) =>
		new SyncTransportController(provider(...params), progressEmitter, connectionEmitter, config);
}

function cloneTransportOptions(transportOpts: SyncTransportOptions): SyncTransportOptions {
	return {
		url: transportOpts.url,
		room: transportOpts.room,
		authToken: transportOpts.authToken,
		pingInterval: transportOpts.pingInterval,
		pingTimeout: transportOpts.pingTimeout
	};
}

function areTransportOptionsEqual(left: SyncTransportOptions, right: SyncTransportOptions): boolean {
	return (
		left.url === right.url &&
		left.room === right.room &&
		left.authToken === right.authToken &&
		left.pingInterval === right.pingInterval &&
		left.pingTimeout === right.pingTimeout
	);
}

class SyncRuntime {
	readonly #db: DBAsync;
	readonly #syncEmitter = new SyncEventEmitter();
	readonly #connEmitter = new ConnectionEventEmitter();

	#activeConfig: { dbid: string; transportOpts: SyncTransportOptions } | null = null;
	#handlePromise: Promise<SyncRuntimeHandle> | null = null;
	#isConnected = false;

	constructor(db: DBAsync) {
		this.#db = db;
		this.#connEmitter.onConnOpen(() => {
			this.#isConnected = true;
		});
		this.#connEmitter.onConnClose(() => {
			this.#isConnected = false;
		});
	}

	async startSync(dbid: string, transportOpts: SyncTransportOptions): Promise<void> {
		const nextTransportOpts = cloneTransportOptions(transportOpts);
		if (this.#activeConfig?.dbid === dbid && areTransportOptionsEqual(this.#activeConfig.transportOpts, nextTransportOpts)) {
			return;
		}

		await this.stopSync(this.#activeConfig?.dbid || dbid);

		const config: Config = {
			dbProvider: async (name) => {
				void name;
				return SharedConnectionSyncDB.create(this.#db);
			},
			transportProvider: wrapTransportProvider(defaultConfig.transportProvider, this.#syncEmitter, this.#connEmitter, {
				maxChunkSize: MAX_SYNC_CHUNK_SIZE
			})
		};

		this.#activeConfig = { dbid, transportOpts: nextTransportOpts };
		const handlePromise = createAndStartSyncedDBExclusive(config, dbid, nextTransportOpts);
		this.#handlePromise = handlePromise;

		let handle: SyncRuntimeHandle;
		try {
			handle = await handlePromise;
		} catch (err) {
			// Clean up state if this is still the active start attempt
			if (this.#handlePromise === handlePromise) {
				this.#handlePromise = null;
				this.#activeConfig = null;
			}
			console.error("[worker] Failed to start sync runtime", err);
			throw err;
		}

		// If another startSync/stopSync superseded this one while we were awaiting,
		// stop the handle we just created — it's no longer the active one.
		if (this.#handlePromise && this.#handlePromise !== handlePromise) {
			void handle.stop().catch((err) => {
				console.warn(`[worker] Failed to stop superseded sync runtime for db '${dbid}'`, err);
			});
		}
	}

	async stopSync(dbid: string): Promise<void> {
		if (!this.#activeConfig) return;
		if (this.#activeConfig.dbid !== dbid) return;

		const handlePromise = this.#handlePromise;
		this.#handlePromise = null;
		this.#activeConfig = null;

		if (handlePromise) {
			try {
				const handle = await handlePromise;
				await handle.stop();
			} catch (err) {
				console.warn(`[worker] Failed to stop sync runtime for db '${dbid}'`, err);
				throw err;
			}
		}

		if (this.#isConnected) {
			this.#isConnected = false;
			this.#connEmitter.notifyConnClose();
		}
	}

	async destroy(): Promise<void> {
		if (this.#activeConfig) {
			await this.stopSync(this.#activeConfig.dbid);
		}
	}

	onChangesReceived(cb: (msg: { timestamp: number }) => void): ReturnType<SyncEventEmitter["onChangesReceived"]> {
		return this.#syncEmitter.onChangesReceived(cb);
	}

	onChangesProcessed(cb: (msg: { timestamp: number }) => void): ReturnType<SyncEventEmitter["onChangesProcessed"]> {
		return this.#syncEmitter.onChangesProcessed(cb);
	}

	onProgress(cb: (msg: SyncProgressPayload) => void): ReturnType<SyncEventEmitter["onProgress"]> {
		return this.#syncEmitter.onProgress(cb);
	}

	onOutgoingChanges(cb: (msg: { maxDbVersion: number; changeCount: number }) => void): ReturnType<SyncEventEmitter["onOutgoingChanges"]> {
		return this.#syncEmitter.onOutgoingChanges(cb);
	}

	onSyncStatus(cb: (msg: SyncStatusPayload) => void): ReturnType<SyncEventEmitter["onSyncStatus"]> {
		return this.#syncEmitter.onSyncStatus(cb);
	}

	onConnOpen(cb: () => void): ReturnType<ConnectionEventEmitter["onConnOpen"]> {
		return this.#connEmitter.onConnOpen(cb);
	}

	onConnClose(cb: () => void): ReturnType<ConnectionEventEmitter["onConnClose"]> {
		return this.#connEmitter.onConnClose(cb);
	}

	get isConnected(): boolean {
		return this.#isConnected;
	}
}

class WrappedDB implements DBAsync, SyncWorkerBridge {
	readonly #syncRuntime: SyncRuntime;

	constructor(readonly internal: DBAsync) {
		this.#syncRuntime = new SyncRuntime(internal);
	}

	get __mutex() {
		return this.internal.__mutex;
	}
	get siteid() {
		return this.internal.siteid;
	}
	get filename() {
		return this.internal.filename;
	}
	get tablesUsedStmt() {
		return Comlink.proxy(this.internal.tablesUsedStmt);
	}

	get isConnected() {
		return this.#syncRuntime.isConnected;
	}

	async prepare(sql: string) {
		const stmt = await this.internal.prepare(sql);
		return Comlink.proxy(stmt);
	}

	exec(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.exec(sql, bind);
	}

	execMany(sql: string[]) {
		return this.internal.execMany(sql);
	}

	execO<O extends Record<string, any>>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.execO(sql, bind) as Promise<O[]>;
	}

	execA<T extends any[]>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.execA(sql, bind) as Promise<T[]>;
	}

	async close() {
		await this.#syncRuntime.destroy();
		return this.internal.close();
	}

	createFunction(name: string, fn: (...args: any) => unknown, opts?: Record<string, any>) {
		return this.internal.createFunction(name, Comlink.proxy(fn), opts);
	}

	onUpdate(cb: OnUpdateCallback): () => void {
		// NOTE: `db.onUpdate` returns a function (unsubscribe) that needs to be proxied (Comlink.proxy) when being
		// returned to the main thread.
		const unsubscribe = this.internal.onUpdate(cb);
		return Comlink.proxy(unsubscribe);
	}

	tx(cb: TXCallback): Promise<void> {
		// NOTE: `db.tx` is called by passing the callback. When calling from the main thread, the callback needs to be
		// proxied (using Comlink.proxy). Furthermore, when calling the proxied callback (from worker to the main thread),
		// the first parameter (the TXAsync object) needs to be proxied back as well.
		// Adapt the 'cb' so that the first param (TXAsync) is proxied back when calling
		const adapt = (txcb: TXCallback): TXCallback => {
			return (tx) => txcb(Comlink.proxy(tx));
		};
		return this.internal.tx(adapt(cb));
	}

	async imperativeTx(): Promise<[() => void, _TXAsync]> {
		// NOTE: `db.imperativeTx` returns releaser and TXAsync object, both of which need to be proxied.
		const [releaser, tx] = await this.internal.imperativeTx();
		return [Comlink.proxy(releaser), Comlink.proxy(tx)];
	}

	automigrateTo(schemaName: string, schemaContent: string): Promise<"noop" | "apply" | "migrate"> {
		return this.internal.automigrateTo(schemaName, schemaContent);
	}

	startSync(dbid: string, transportOpts: SyncTransportOptions): Promise<void> {
		return this.#syncRuntime.startSync(dbid, transportOpts);
	}

	stopSync(dbid: string): Promise<void> {
		return this.#syncRuntime.stopSync(dbid);
	}

	onChangesReceived(cb: (msg: { timestamp: number }) => void): () => void {
		const unsubscribe = this.#syncRuntime.onChangesReceived(cb);
		return Comlink.proxy(unsubscribe);
	}

	onChangesProcessed(cb: (msg: { timestamp: number }) => void): () => void {
		const unsubscribe = this.#syncRuntime.onChangesProcessed(cb);
		return Comlink.proxy(unsubscribe);
	}

	onProgress(cb: (msg: SyncProgressPayload) => void): () => void {
		const unsubscribe = this.#syncRuntime.onProgress(cb);
		return Comlink.proxy(unsubscribe);
	}

	onOutgoingChanges(cb: (msg: { maxDbVersion: number; changeCount: number }) => void): () => void {
		const unsubscribe = this.#syncRuntime.onOutgoingChanges(cb);
		return Comlink.proxy(unsubscribe);
	}

	onSyncStatus(cb: (msg: SyncStatusPayload) => void): () => void {
		const unsubscribe = this.#syncRuntime.onSyncStatus(cb);
		return Comlink.proxy(unsubscribe);
	}

	onConnOpen(cb: () => void): () => void {
		const unsubscribe = this.#syncRuntime.onConnOpen(cb);
		return Comlink.proxy(unsubscribe);
	}

	onConnClose(cb: () => void): () => void {
		const unsubscribe = this.#syncRuntime.onConnClose(cb);
		return Comlink.proxy(unsubscribe);
	}
}

function wrapDB(db: DBAsync) {
	return new WrappedDB(db);
}
