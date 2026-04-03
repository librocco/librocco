import * as Comlink from "comlink";

import type {
	DBAsync,
	OnUpdateCallback,
	StmtAsync,
	SyncStatusPayload,
	SyncTransportOptions,
	SyncWorkerBridge,
	TMutex,
	TXCallback,
	_TXAsync
} from "./types";

import DBWorker from "./worker-db.worker?worker";
import DBSharedWorker from "./worker-db.worker?sharedworker";
import type { MsgInit } from "./worker-db.worker";

// ---------------------------------------------------------------------------
// Active connection tracking (for disconnectAllPorts / pagehide teardown)
// ---------------------------------------------------------------------------

// SharedWorker ports (Chrome, Firefox, desktop Safari)
const activePorts = new Set<MessagePort>();
// DedicatedWorker instances (iOS Safari fallback)
const activeWorkers = new Set<Worker>();

/**
 * Synchronously closes all active DB connections:
 * - SharedWorker: closes MessagePorts (browser GCs the worker when last port closes → OPFS released)
 * - DedicatedWorker (iOS): terminates the worker directly (OPFS released immediately)
 *
 * Call this from pagehide/beforeunload to prevent lock conflicts on rapid reload.
 */
export function disconnectAllPorts(): void {
	for (const p of activePorts) {
		p.close();
	}
	activePorts.clear();
	for (const w of activeWorkers) {
		w.terminate();
	}
	activeWorkers.clear();
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function getWorkerDB(dbname: string, vfs: string): Promise<DBAsync> {
	if (typeof SharedWorker !== "undefined") {
		return getSharedWorkerDB(dbname, vfs);
	}
	// iOS Safari / environments without SharedWorker support → DedicatedWorker fallback
	return getDedicatedWorkerDB(dbname, vfs);
}

// ---------------------------------------------------------------------------
// SharedWorker path
// ---------------------------------------------------------------------------

async function getSharedWorkerDB(dbname: string, vfs: string): Promise<DBAsync> {
	console.time("[worker-db] SharedWorker port init");
	const port = await initWorkerPort(dbname, vfs);
	console.timeEnd("[worker-db] SharedWorker port init");

	console.time("[worker-db] comlink setup (shared)");
	try {
		const ifc = Comlink.wrap<DBAsyncRemote>(port);
		const [__mutex, siteid, filename, tablesUsedStmt] = await Promise.all([ifc.__mutex, ifc.siteid, ifc.filename, ifc.tablesUsedStmt]);
		console.timeEnd("[worker-db] comlink setup (shared)");
		const cleanup = () => {
			port.close();
			activePorts.delete(port);
		};
		return new WorkerDB(cleanup, ifc, __mutex, siteid, filename, tablesUsedStmt);
	} catch (err) {
		console.timeEnd("[worker-db] comlink setup (shared)");
		port.close();
		activePorts.delete(port);
		throw err;
	}
}

function initWorkerPort(dbname: string, vfs: string): Promise<MessagePort> {
	const name = [dbname, vfs].join("---");
	const sharedWkr = new DBSharedWorker({ name });
	const port = sharedWkr.port;
	port.start();
	activePorts.add(port);

	return new Promise<MessagePort>((resolve, reject) => {
		const listener = (e: MessageEvent) => {
			const isInitMsg = (e: MessageEvent): e is MessageEvent<MsgInit> => e.data?._type === "wkr-init";
			if (!isInitMsg(e)) return;
			port.removeEventListener("message", listener);
			switch (e.data.status) {
				case "ok":
					return resolve(port);
				case "error": {
					port.close();
					activePorts.delete(port);
					const err = new Error(e.data.error);
					if (e.data.stack) {
						err.stack = e.data.stack;
					}
					return reject(err);
				}
			}
		};
		port.addEventListener("message", listener);
	});
}

// ---------------------------------------------------------------------------
// DedicatedWorker path (iOS Safari fallback — original implementation)
// ---------------------------------------------------------------------------

async function getDedicatedWorkerDB(dbname: string, vfs: string): Promise<DBAsync> {
	console.time("[worker-db] DedicatedWorker init");
	const wkr = await initDedicatedWorker(dbname, vfs);
	console.timeEnd("[worker-db] DedicatedWorker init");

	console.time("[worker-db] comlink setup (dedicated)");
	try {
		const ifc = Comlink.wrap<DBAsyncRemote>(wkr);
		const [__mutex, siteid, filename, tablesUsedStmt] = await Promise.all([ifc.__mutex, ifc.siteid, ifc.filename, ifc.tablesUsedStmt]);
		console.timeEnd("[worker-db] comlink setup (dedicated)");
		const cleanup = () => {
			wkr.terminate();
			activeWorkers.delete(wkr);
		};
		return new WorkerDB(cleanup, ifc, __mutex, siteid, filename, tablesUsedStmt);
	} catch (err) {
		console.timeEnd("[worker-db] comlink setup (dedicated)");
		wkr.terminate();
		activeWorkers.delete(wkr);
		throw err;
	}
}

function initDedicatedWorker(dbname: string, vfs: string): Promise<Worker> {
	const name = [dbname, vfs].join("---");
	const wkr = new DBWorker({ name });
	activeWorkers.add(wkr);

	return new Promise<Worker>((resolve, reject) => {
		const listener = (e: MessageEvent) => {
			const isInitMsg = (e: MessageEvent): e is MessageEvent<MsgInit> => e.data?._type === "wkr-init";
			if (!isInitMsg(e)) return;
			switch (e.data.status) {
				case "ok": {
					wkr.removeEventListener("message", listener);
					return resolve(wkr);
				}
				case "error": {
					wkr.removeEventListener("message", listener);
					wkr.terminate();
					activeWorkers.delete(wkr);
					const err = new Error(e.data.error);
					if (e.data.stack) {
						err.stack = e.data.stack;
					}
					return reject(err);
				}
			}
		};
		wkr.addEventListener("message", listener);
	});
}

// ---------------------------------------------------------------------------
// WorkerDB: main-thread proxy over the worker DB
// ---------------------------------------------------------------------------

class WorkerDB implements DBAsync {
	private _teardown: () => void;
	private _isConnected = false;

	constructor(
		teardown: () => void,
		readonly remote: Comlink.Remote<DBAsyncRemote>,
		// TODO: running the mutex over a Comlink proxy might not be the terribly performant solution,
		// check if we should implement a local mutex here.
		readonly __mutex: TMutex,
		readonly siteid: string,
		readonly filename: string,
		readonly tablesUsedStmt: StmtAsync
	) {
		this._teardown = teardown;
		void Promise.resolve(this.remote.isConnected)
			.then((connected) => {
				this._isConnected = connected;
			})
			.catch((err) => {
				console.warn("[worker] failed to read remote.isConnected", err);
				this._isConnected = false;
			});
	}

	/**
	 * Synchronously closes the underlying connection (port or worker), immediately releasing
	 * any OPFS file handles. Use this on page unload instead of the async close().
	 */
	terminate(): void {
		this._teardown();
	}

	prepare(sql: string) {
		return this.remote.prepare(sql);
	}

	exec(sql: string, bind: SQLiteCompatibleType[]) {
		return this.remote.exec(sql, bind);
	}

	execMany(sql: string[]) {
		return this.remote.execMany(sql);
	}

	execO<O extends Record<string, any>>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.remote.execO(sql, bind) as Promise<O[]>;
	}

	execA<T extends any[]>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.remote.execA(sql, bind) as Promise<T[]>;
	}

	close() {
		return this.remote.close().finally(() => this._teardown());
	}

	createFunction(name: string, fn: (...args: any) => unknown, opts?: Record<string, any>) {
		return this.remote.createFunction(name, Comlink.proxy(fn), opts);
	}

	onUpdate(cb: OnUpdateCallback): () => void {
		// NOTE: everything done over the wire is a Promise, whereas 'onUpdate' signature expects the unsubscribe function
		// to be returned immediately, so we create a function that (internally) waits for the unsubscribe and calls it
		const res = this.remote.onUpdate(Comlink.proxy(cb));
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onUpdate listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onUpdate listener", error);
				}); // Everything done over the wire is a Promise
	}

	tx(cb: TXCallback): Promise<void> {
		return this.remote.tx(Comlink.proxy(cb));
	}

	imperativeTx(): Promise<[() => void, _TXAsync]> {
		return this.remote.imperativeTx();
	}

	automigrateTo(schemaName: string, schemaContent: string): Promise<"noop" | "apply" | "migrate"> {
		return this.remote.automigrateTo(schemaName, schemaContent);
	}

	startSync(dbid: string, transportOpts: SyncTransportOptions): Promise<void> {
		return this.remote.startSync(dbid, transportOpts);
	}

	stopSync(dbid: string): Promise<void> {
		return this.remote.stopSync(dbid);
	}

	onChangesReceived(cb: (msg: { timestamp: number }) => void): () => void {
		const res = this.remote.onChangesReceived(Comlink.proxy(cb));
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onChangesReceived listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onChangesReceived listener", error);
				});
	}

	onChangesProcessed(cb: (msg: { timestamp: number }) => void): () => void {
		const res = this.remote.onChangesProcessed(Comlink.proxy(cb));
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onChangesProcessed listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onChangesProcessed listener", error);
				});
	}

	onProgress(cb: (msg: { active: boolean; nProcessed: number; nTotal: number }) => void): () => void {
		const res = this.remote.onProgress(Comlink.proxy(cb));
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onProgress listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onProgress listener", error);
				});
	}

	onOutgoingChanges(cb: (msg: { maxDbVersion: number; changeCount: number }) => void): () => void {
		const res = this.remote.onOutgoingChanges(Comlink.proxy(cb));
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onOutgoingChanges listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onOutgoingChanges listener", error);
				});
	}

	onSyncStatus(cb: (msg: SyncStatusPayload) => void): () => void {
		const res = this.remote.onSyncStatus(Comlink.proxy(cb));
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onSyncStatus listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onSyncStatus listener", error);
				});
	}

	onConnOpen(cb: () => void): () => void {
		const res = this.remote.onConnOpen(
			Comlink.proxy(() => {
				this._isConnected = true;
				cb();
			})
		);
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onConnOpen listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onConnOpen listener", error);
				});
	}

	onConnClose(cb: () => void): () => void {
		const res = this.remote.onConnClose(
			Comlink.proxy(() => {
				this._isConnected = false;
				cb();
			})
		);
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onConnClose listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onConnClose listener", error);
				});
	}

	get isConnected(): boolean {
		return this._isConnected;
	}
}

type DBAsyncRemote = DBAsync & SyncWorkerBridge;
