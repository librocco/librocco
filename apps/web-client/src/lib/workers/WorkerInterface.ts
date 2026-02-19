import type { DBAsync, SyncTransportOptions, SyncWorkerBridge, VFSWhitelist } from "$lib/db/cr-sqlite/core";
import { isSyncWorkerBridge } from "$lib/db/cr-sqlite/core";
import type { MsgSyncStatus } from "./types";

import { ConnectionEventEmitter, SyncEventEmitter } from "./sync-transport-control";

export default class WorkerInterface {
	#endpoint: SyncWorkerBridge | null = null;
	#bridgeDisposers: Array<() => void> = [];

	#syncEmitter: SyncEventEmitter;
	#connEmitter: ConnectionEventEmitter;

	#vfs: VFSWhitelist | null = null;

	#initPromiseResolver: () => void;
	#initPromise: Promise<void>;
	get initPromise() {
		return this.#initPromise;
	}

	#isConnected = false;

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

	bind(endpoint: DBAsync | SyncWorkerBridge | null) {
		const nextEndpoint = endpoint && isSyncWorkerBridge(endpoint) ? endpoint : null;
		if (nextEndpoint === this.#endpoint) {
			return;
		}

		const wasConnected = this.#isConnected;
		this.#disposeBridge();
		this.#endpoint = nextEndpoint;
		this.#isConnected = false;
		if (wasConnected) {
			this.#connEmitter.notifyConnClose();
		}

		if (!nextEndpoint) {
			this.#initPromiseResolver();
			return;
		}

		this.#bridgeDisposers = [
			nextEndpoint.onChangesReceived((msg) => this.#syncEmitter.notifyChangesReceived(msg)),
			nextEndpoint.onChangesProcessed((msg) => this.#syncEmitter.notifyChangesProcessed(msg)),
			nextEndpoint.onProgress((msg) => this.#syncEmitter.notifyProgress(msg)),
			nextEndpoint.onOutgoingChanges((msg) => this.#syncEmitter.notifyOutgoingChanges(msg)),
			nextEndpoint.onSyncStatus((msg) => this.#syncEmitter.notifySyncStatusWithCache(msg)),
			nextEndpoint.onConnOpen(() => this.#connEmitter.notifyConnOpen()),
			nextEndpoint.onConnClose(() => this.#connEmitter.notifyConnClose())
		];

		if (nextEndpoint.isConnected) {
			this.#connEmitter.notifyConnOpen();
		}
		this.#initPromiseResolver();
	}

	#disposeBridge() {
		for (const dispose of this.#bridgeDisposers) {
			dispose();
		}
		this.#bridgeDisposers = [];
	}

	start(vfs: VFSWhitelist) {
		this.#vfs = vfs;
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
		this.#endpoint.stopSync(dbid);
	}

	destroy() {
		this.#disposeBridge();
		this.#endpoint = null;
		this.#isConnected = false;
	}

	vfs() {
		return this.#vfs;
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
