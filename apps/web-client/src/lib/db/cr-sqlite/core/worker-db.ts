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
import { SharedService, createPortBroker } from "./shared-service";

// ---------------------------------------------------------------------------
// Active connection tracking (for disconnectAllPorts / pagehide teardown)
// ---------------------------------------------------------------------------

// SharedService client ports (non-leader tabs)
const activePorts = new Set<MessagePort>();
// DedicatedWorker instances (leader tab, or iOS fallback)
const activeWorkers = new Set<Worker>();
// Active SharedService instances
const activeServices = new Set<SharedService>();

/**
 * Synchronously closes all active DB connections:
 * - Closes MessagePorts (client tabs)
 * - Terminates DedicatedWorkers (leader tab / iOS fallback)
 * - Deactivates SharedService (releases Web Lock for leader election)
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
	for (const s of activeServices) {
		s.close();
	}
	activeServices.clear();
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function getWorkerDB(dbname: string, vfs: string): Promise<DBAsync> {
	// In environments without SharedWorker (iOS Safari) or during vitest browser
	// tests (single-tab, no SharedWorker OPFS support), skip the shared service
	// and use a plain DedicatedWorker directly.
	const isTestEnv = import.meta.env.MODE === "test";
	if (typeof SharedWorker === "undefined" || isTestEnv) {
		return getDedicatedWorkerDB(dbname, vfs);
	}
	return getSharedServiceDB(dbname, vfs);
}

// ---------------------------------------------------------------------------
// Shared service path (production multi-tab)
// ---------------------------------------------------------------------------

async function getSharedServiceDB(dbname: string, vfs: string): Promise<DBAsync> {
	const serviceName = [dbname, vfs].join("---");

	const service = new SharedService(serviceName, async () => {
		// This callback runs only on the leader tab.
		// Spawn a DedicatedWorker and wait for it to initialize (WASM load, VFS setup,
		// DB open) before accepting client ports. This ensures the worker's client-port
		// handler is registered before any ports arrive.
		const wkr = new DBWorker({ name: serviceName });
		activeWorkers.add(wkr);

		const WORKER_INIT_TIMEOUT = 10_000;
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				wkr.removeEventListener("message", listener);
				wkr.terminate();
				activeWorkers.delete(wkr);
				reject(new Error("DedicatedWorker init timed out"));
			}, WORKER_INIT_TIMEOUT);

			const listener = (e: MessageEvent) => {
				const isInitMsg = (e: MessageEvent): e is MessageEvent<MsgInit> => e.data?._type === "wkr-init";
				if (!isInitMsg(e)) return;
				clearTimeout(timer);
				wkr.removeEventListener("message", listener);
				if (e.data.status === "ok") {
					resolve();
				} else {
					wkr.terminate();
					activeWorkers.delete(wkr);
					reject(new Error(e.data.error));
				}
			};
			wkr.addEventListener("message", listener);
		});

		return createPortBroker((clientPort: MessagePort) => {
			// Transfer the client's port to the DedicatedWorker so Comlink
			// can expose the DB on it directly.
			wkr.postMessage({ _type: "client-port" }, [clientPort]);
		});
	});

	activeServices.add(service);
	service.activate();

	// Wait for a provider to be available and get our port to the worker.
	console.time("[worker-db] shared service port");
	let port: MessagePort;
	try {
		port = await service.getPort();
	} catch (err) {
		console.warn("[worker-db] shared service init failed, falling back to DedicatedWorker:", err);
		console.timeEnd("[worker-db] shared service port");
		service.close();
		activeServices.delete(service);
		return getDedicatedWorkerDB(dbname, vfs);
	}
	console.timeEnd("[worker-db] shared service port");

	activePorts.add(port);

	// If we're the leader, the DedicatedWorker was just spawned — wait for it to init.
	// If we're a client, the worker is already running — Comlink calls will just work.
	// Either way, we need to wait for the wkr-init handshake IF this port is the leader's
	// direct worker port. For client ports (via relay), the worker is already initialized
	// and Comlink is already exposed — no handshake needed.
	//
	// The leader's DedicatedWorker posts wkr-init on `self` (its main port), not on
	// client ports. So client tabs skip the handshake — Comlink.wrap just works.

	console.time("[worker-db] comlink setup (shared-service)");
	try {
		const ifc = Comlink.wrap<DBAsyncRemote>(port);
		const [__mutex, siteid, filename, tablesUsedStmt] = await Promise.all([ifc.__mutex, ifc.siteid, ifc.filename, ifc.tablesUsedStmt]);
		console.timeEnd("[worker-db] comlink setup (shared-service)");

		const cleanup = () => {
			port.close();
			activePorts.delete(port);
		};

		if (typeof window !== "undefined") (window as any).__librocco_worker_type = "shared-service";
		return new WorkerDB(cleanup, ifc, __mutex, siteid, filename, tablesUsedStmt);
	} catch (err) {
		console.timeEnd("[worker-db] comlink setup (shared-service)");
		port.close();
		activePorts.delete(port);
		throw err;
	}
}

// ---------------------------------------------------------------------------
// DedicatedWorker path (iOS Safari fallback / test env)
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

		if (typeof window !== "undefined") (window as any).__librocco_worker_type = "dedicated";
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
		const res = this.remote.onUpdate(Comlink.proxy(cb));
		void res.catch((error) => {
			console.warn("[worker] Failed to subscribe onUpdate listener", error);
		});
		return () =>
			res
				.then((unsubscribe) => unsubscribe())
				.catch((error) => {
					console.warn("[worker] Failed to unsubscribe onUpdate listener", error);
				});
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
