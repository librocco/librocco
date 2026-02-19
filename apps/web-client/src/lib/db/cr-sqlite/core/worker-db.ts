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
import type { MsgInit } from "./worker-db.worker";

// Track all active DB workers so they can be terminated synchronously on page unload,
// even if the page reloads before getWorkerDB() completes (before app.db.db is set).
const activeWorkers = new Set<Worker>();

/**
 * Synchronously terminates all active DB workers, immediately releasing OPFS file handles.
 * Call this from pagehide/beforeunload to prevent lock conflicts on rapid reload.
 */
export function terminateAllWorkers(): void {
	for (const w of activeWorkers) {
		w.terminate();
	}
	activeWorkers.clear();
}

export async function getWorkerDB(dbname: string, vfs: string): Promise<DBAsync> {
	const wkr = await initWorker(dbname, vfs);

	const ifc = Comlink.wrap<DBAsyncRemote>(wkr);
	const [__mutex, siteid, filename, tablesUsedStmt] = await Promise.all([ifc.__mutex, ifc.siteid, ifc.filename, ifc.tablesUsedStmt]);

	return new WorkerDB(wkr, ifc, __mutex, siteid, filename, tablesUsedStmt);
}

function initWorker(dbname: string, vfs: string) {
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

class WorkerDB implements DBAsync {
	private _worker: Worker;
	private _isConnected = false;

	constructor(
		worker: Worker,
		readonly remote: Comlink.Remote<DBAsyncRemote>,
		// TODO: running the mutex over a Comlink proxy might not be the terribly performant solution,
		// check if we should implement a local mutex here.
		readonly __mutex: TMutex,
		readonly siteid: string,
		readonly filename: string,
		readonly tablesUsedStmt: StmtAsync
	) {
		this._worker = worker;
		void Promise.resolve(this.remote.isConnected)
			.then((connected) => {
				this._isConnected = connected;
			})
			.catch(() => {
				this._isConnected = false;
			});
	}

	/**
	 * Synchronously terminates the underlying Web Worker, immediately releasing
	 * any OPFS file handles. Use this on page unload instead of the async close().
	 */
	terminate(): void {
		this._worker.terminate();
		activeWorkers.delete(this._worker);
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
		return this.remote.close().finally(() => {
			this._worker.terminate();
			activeWorkers.delete(this._worker);
		});
	}

	createFunction(name: string, fn: (...args: any) => unknown, opts?: Record<string, any>) {
		return this.remote.createFunction(name, Comlink.proxy(fn), opts);
	}

	onUpdate(cb: OnUpdateCallback): () => void {
		// NOTE: everything done over the wire is a Promise, whereas 'onUpdate' signature expects the unsubscribe function
		// to be returned immediately, so we create a function that (internally) waits for the unsubscribe and calls it
		const res = this.remote.onUpdate(Comlink.proxy(cb));
		return () => res.then((unsubscribe) => unsubscribe()); // Everything done over the wire is a Promise
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
		return () => res.then((unsubscribe) => unsubscribe());
	}

	onChangesProcessed(cb: (msg: { timestamp: number }) => void): () => void {
		const res = this.remote.onChangesProcessed(Comlink.proxy(cb));
		return () => res.then((unsubscribe) => unsubscribe());
	}

	onProgress(cb: (msg: { active: boolean; nProcessed: number; nTotal: number }) => void): () => void {
		const res = this.remote.onProgress(Comlink.proxy(cb));
		return () => res.then((unsubscribe) => unsubscribe());
	}

	onOutgoingChanges(cb: (msg: { maxDbVersion: number; changeCount: number }) => void): () => void {
		const res = this.remote.onOutgoingChanges(Comlink.proxy(cb));
		return () => res.then((unsubscribe) => unsubscribe());
	}

	onSyncStatus(cb: (msg: SyncStatusPayload) => void): () => void {
		const res = this.remote.onSyncStatus(Comlink.proxy(cb));
		return () => res.then((unsubscribe) => unsubscribe());
	}

	onConnOpen(cb: () => void): () => void {
		const res = this.remote.onConnOpen(
			Comlink.proxy(() => {
				this._isConnected = true;
				cb();
			})
		);
		return () => res.then((unsubscribe) => unsubscribe());
	}

	onConnClose(cb: () => void): () => void {
		const res = this.remote.onConnClose(
			Comlink.proxy(() => {
				this._isConnected = false;
				cb();
			})
		);
		return () => res.then((unsubscribe) => unsubscribe());
	}

	get isConnected(): boolean {
		return this._isConnected;
	}
}

type DBAsyncRemote = DBAsync & SyncWorkerBridge;
