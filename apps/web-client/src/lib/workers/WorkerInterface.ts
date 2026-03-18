import type { DBAsync, SyncTransportOptions, SyncWorkerBridge } from "$lib/db/cr-sqlite/core/types";
import { isSyncWorkerBridge } from "$lib/db/cr-sqlite/core/types";
import type { MsgSyncStatus } from "./types";

import { ConnectionEventEmitter, SyncEventEmitter } from "./sync-transport-control";

export default class WorkerInterface {
	#endpoint: SyncWorkerBridge | null = null;
	#bridgeDisposers: Array<() => void> = [];
	#disposePromise: Promise<void> = Promise.resolve();
	#destroyed = false;
	#lifecycleVersion = 0;

	#syncEmitter: SyncEventEmitter;
	#connEmitter: ConnectionEventEmitter;

	#initPromiseResolver: () => void;
	#initPromise: Promise<void>;
	get initPromise() {
		return this.#initPromise;
	}

	#isConnected = false;

	#markConnected() {
		if (this.#isConnected) return;
		this.#connEmitter.notifyConnOpen();
	}

	#markDisconnected() {
		if (!this.#isConnected) return;
		this.#connEmitter.notifyConnClose();
	}

	constructor(endpoint?: DBAsync | SyncWorkerBridge | null) {
		this.#syncEmitter = new SyncEventEmitter();

		this.#connEmitter = new ConnectionEventEmitter();
		this.#connEmitter.onConnOpen(() => (this.#isConnected = true));
		this.#connEmitter.onConnClose(() => (this.#isConnected = false));

		this.#initPromise = new Promise((resolve) => {
			this.#initPromiseResolver = resolve;
		});

		if (endpoint) {
			this.bind(endpoint);
		}
	}

	bind(endpoint: DBAsync | SyncWorkerBridge | null): void {
		this.#destroyed = false;
		const lifecycleVersion = ++this.#lifecycleVersion;
		const nextEndpoint = endpoint && isSyncWorkerBridge(endpoint) ? endpoint : null;
		if (nextEndpoint === this.#endpoint) {
			if (nextEndpoint === null) {
				this.#initPromiseResolver();
			}
			return;
		}

		const wasConnected = this.#isConnected;
		this.#disposeBridge();
		const disposePromise = this.#disposePromise;
		this.#endpoint = nextEndpoint;
		this.#isConnected = false;
		if (wasConnected) {
			this.#connEmitter.notifyConnClose();
		}

		if (!nextEndpoint) {
			this.#initPromiseResolver();
			return;
		}

		void disposePromise.then(() => {
			// A newer bind() call may have replaced the endpoint while unsubscribes
			// from the previous bridge were still settling.
			if (this.#destroyed || this.#lifecycleVersion !== lifecycleVersion || this.#endpoint !== nextEndpoint) {
				return;
			}

			this.#bridgeDisposers = [
				nextEndpoint.onChangesReceived((msg) => this.#syncEmitter.notifyChangesReceived(msg)),
				nextEndpoint.onChangesProcessed((msg) => this.#syncEmitter.notifyChangesProcessed(msg)),
				nextEndpoint.onProgress((msg) => this.#syncEmitter.notifyProgress(msg)),
				nextEndpoint.onOutgoingChanges((msg) => this.#syncEmitter.notifyOutgoingChanges(msg)),
				nextEndpoint.onSyncStatus((msg) => {
					this.#syncEmitter.notifySyncStatusWithCache(msg);
					// Sync status is cached and replayed by the bridge. Reconcile connection
					// state from it as well so bind() cannot permanently miss a connection
					// that became ready before the connOpen listener was attached.
					if (msg.ok) {
						this.#markConnected();
					} else {
						this.#markDisconnected();
					}
				}),
				nextEndpoint.onConnOpen(() => this.#markConnected()),
				nextEndpoint.onConnClose(() => this.#markDisconnected())
			];

			if (nextEndpoint.isConnected) {
				this.#markConnected();
			}
			this.#initPromiseResolver();
		});
	}

	#disposeBridge() {
		const disposers = this.#bridgeDisposers;
		this.#bridgeDisposers = [];
		// Disposers from Comlink-proxied endpoints may internally start async
		// unsubscribe chains. Capture any returned promises so destroy() can wait.
		const pending: Promise<void>[] = [];
		for (const dispose of disposers) {
			try {
				const result = dispose() as unknown;
				if (result instanceof Promise) {
					pending.push(result);
				}
			} catch (err) {
				console.warn("[worker] Failed to dispose sync bridge listener", err);
			}
		}
		const disposeWork = pending.length > 0 ? Promise.allSettled(pending).then(() => {}) : Promise.resolve();
		this.#disposePromise = this.#disposePromise.then(
			() => disposeWork,
			() => disposeWork
		);
	}

	startSync(dbid: string, transportOpts: SyncTransportOptions) {
		if (!this.#endpoint) {
			console.warn("[worker] Sync endpoint is not bound, noop -- sync not started");
			return;
		}
		return this.#endpoint.startSync(dbid, transportOpts);
	}

	stopSync(dbid: string) {
		if (!this.#endpoint) return;
		return this.#endpoint.stopSync(dbid);
	}

	async destroy() {
		const lifecycleVersion = ++this.#lifecycleVersion;
		this.#destroyed = true;
		if (this.#isConnected) {
			this.#connEmitter.notifyConnClose();
		}
		this.#disposeBridge();
		await this.#disposePromise;
		if (this.#lifecycleVersion !== lifecycleVersion) {
			return;
		}
		this.#endpoint = null;
		this.#isConnected = false;
	}

	onChangesReceived(cb: (msg: { timestamp: number }) => void) {
		return this.#syncEmitter.onChangesReceived(cb);
	}
	onChangesProcessed(cb: (msg: { timestamp: number }) => void) {
		return this.#syncEmitter.onChangesProcessed(cb);
	}
	onProgress(cb: (msg: { active: boolean; nProcessed: number; nTotal: number }) => void) {
		return this.#syncEmitter.onProgress(cb);
	}
	onOutgoingChanges(cb: (msg: { maxDbVersion: number; changeCount: number }) => void) {
		return this.#syncEmitter.onOutgoingChanges(cb);
	}
	onSyncStatus(cb: (msg: MsgSyncStatus["payload"]) => void) {
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
