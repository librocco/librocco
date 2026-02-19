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
			db.prepare(`INSERT INTO crsql_changes ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
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
		const schemaVersion = BigInt(schemaVersionRows[0]?.[0] || -1);

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

	async pullChangeset(
		since: readonly [bigint, number],
		excludeSites: readonly Uint8Array[],
		localOnly: boolean
	): Promise<any[]> {
		void localOnly;
		const ret = await this.#pullChangesetStmt.all(null, since[0], excludeSites[0]);
		for (const c of ret) {
			c[4] = BigInt(c[4]);
			c[5] = BigInt(c[5]);
			c[7] = BigInt(c[7]);
		}
		return ret;
	}

	async applyChangesetAndSetLastSeen(changes: readonly any[], siteId: Uint8Array, end: readonly [bigint, number]): Promise<void> {
		this.#applyingRemoteChanges = true;
		try {
			await this.#db.tx(async (tx) => {
				for (const c of changes) {
					await this.#applyChangesetStmt.run(tx, c[0], c[1], c[2], c[3], c[4], c[5], siteId, c[7], c[8]);
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

	close(closeWrappedDB: boolean): void {
		void closeWrappedDB;
		if (this.#closed) return;
		this.#closed = true;
		void this.#pullChangesetStmt.finalize(null);
		void this.#applyChangesetStmt.finalize(null);
		void this.#updatePeerTrackerStmt.finalize(null);
		this.#onUpdateDisposer();
		this.#changeListeners.clear();
	}
}

type SyncRuntimeHandle = { stop: () => void };

async function createAndStartSyncedDBExclusive(
	config: Config,
	dbname: string,
	transportOptions: SyncTransportOptions
): Promise<SyncRuntimeHandle> {
	let stopRequested = false;
	let db: Awaited<ReturnType<typeof createSyncedDB>> | null = null;
	let releaser: (() => void) | null = null;
	const hold = new Promise<void>((resolve) => {
		releaser = resolve;
	});

	const run = () => {
		if (stopRequested) return;
		createSyncedDB(config, dbname, transportOptions)
			.then((syncedDb) => {
				if (stopRequested) return;
				db = syncedDb;
				void syncedDb.start();
			})
			.catch((err) => {
				console.error("[worker] Failed to create synced DB runtime", err);
			});
	};

	if (typeof navigator !== "undefined" && navigator?.locks) {
		navigator.locks.request(dbname, () => {
			run();
			return hold;
		});
	} else {
		run();
	}

	return {
		stop: () => {
			stopRequested = true;
			releaser?.();
			db?.stop();
		}
	};
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

class SyncRuntime {
	readonly #db: DBAsync;
	readonly #syncEmitter = new SyncEventEmitter();
	readonly #connEmitter = new ConnectionEventEmitter();

	#activeConfig: { dbid: string; url: string } | null = null;
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
		if (this.#activeConfig?.dbid === dbid && this.#activeConfig?.url === transportOpts.url) {
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

		this.#activeConfig = { dbid, url: transportOpts.url };
		const handlePromise = createAndStartSyncedDBExclusive(config, dbid, transportOpts);
		this.#handlePromise = handlePromise;

		const handle = await handlePromise;
		if (this.#handlePromise !== handlePromise) {
			handle.stop();
		}
	}

	async stopSync(dbid: string): Promise<void> {
		if (!this.#activeConfig) return;
		if (this.#activeConfig.dbid !== dbid) return;

		const handlePromise = this.#handlePromise;
		this.#handlePromise = null;
		this.#activeConfig = null;

		if (handlePromise) {
			const handle = await handlePromise;
			handle.stop();
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

	onChangesReceived(cb: (msg: { timestamp: number }) => void) {
		return this.#syncEmitter.onChangesReceived(cb);
	}

	onChangesProcessed(cb: (msg: { timestamp: number }) => void) {
		return this.#syncEmitter.onChangesProcessed(cb);
	}

	onProgress(cb: (msg: SyncProgressPayload) => void) {
		return this.#syncEmitter.onProgress(cb);
	}

	onOutgoingChanges(cb: (msg: { maxDbVersion: number; changeCount: number }) => void) {
		return this.#syncEmitter.onOutgoingChanges(cb);
	}

	onSyncStatus(cb: (msg: SyncStatusPayload) => void) {
		return this.#syncEmitter.onSyncStatus(cb);
	}

	onConnOpen(cb: () => void) {
		return this.#connEmitter.onConnOpen(cb);
	}

	onConnClose(cb: () => void) {
		return this.#connEmitter.onConnClose(cb);
	}

	get isConnected() {
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
