import { WorkerInterface as WI } from "@vlcn.io/ws-client";

import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import type {
	MsgChangesProcessed,
	MsgChangesReceived,
	MsgConnectionClose,
	MsgConnectionOpen,
	MsgSyncStatus,
	MsgOutgoingChanges,
	MsgProgress,
	MsgReady,
	MsgStart
} from "./types";

import { SyncEventEmitter, ConnectionEventEmitter } from "./sync-transport-control";

type OutbounrMessage = MsgStart;
type InboundMessage =
	| MsgChangesReceived
	| MsgChangesProcessed
	| MsgOutgoingChanges
	| MsgProgress
	| MsgReady
	| MsgConnectionOpen
	| MsgConnectionClose
	| MsgSyncStatus;

export default class WorkerInterface extends WI {
	#worker: Worker;

	#syncEmitter: SyncEventEmitter;
	#connEmitter: ConnectionEventEmitter;

	#vfs: VFSWhitelist | null = null;

	#initPromiseResolver: () => void;
	#initPromise: Promise<void>;
	get initPromise() {
		return this.#initPromise;
	}

	#isConnected = false;

	constructor(worker: Worker) {
		super(worker);
		this.#worker = worker;

		this.#syncEmitter = new SyncEventEmitter();

		this.#connEmitter = new ConnectionEventEmitter();
		this.#connEmitter.onConnOpen(() => (this.#isConnected = true));
		this.#connEmitter.onConnClose(() => (this.#isConnected = false));

		this.#worker.addEventListener("message", this._handleMessage.bind(this));

		this.#initPromise = new Promise((resolve) => {
			this.#initPromiseResolver = resolve;
		});
	}

	private _sendMessage(msg: OutbounrMessage) {
		this.#worker.postMessage(msg);
	}

	private _handleMessage(e: MessageEvent<unknown>) {
		if (!(e as MessageEvent<InboundMessage>).data._type) return;
		const { data: msg } = e as MessageEvent<InboundMessage>;

		switch (msg._type) {
			case "changesReceived":
				console.log("[worker-ifc] changesReceived", msg.payload);
				this.#syncEmitter.notifyChangesReceived(msg.payload);
				break;
			case "changesProcessed":
				this.#syncEmitter.notifyChangesProcessed(msg.payload);
				break;
			case "progress":
				console.log("[worker-ifc] progress", msg.payload);
				this.#syncEmitter.notifyProgress(msg.payload);
				break;
			case "outgoingChanges":
				this.#syncEmitter.notifyOutgoingChanges(msg.payload);
				break;
			case "ready":
				this.#initPromiseResolver();
				break;
			case "connection.open":
				this.#connEmitter.notifyConnOpen();
				break;
			case "connection.close":
				this.#connEmitter.notifyConnClose();
				break;
			case "sync.status":
				this.#syncEmitter.notifySyncStatusWithCache(msg.payload);
				break;
			default:
				break;
		}
	}

	start(vfs: VFSWhitelist) {
		if (!vfs) {
			console.warn("[worker] No VFS specified, noop -- worker not started");
			return;
		}

		this.#vfs = vfs;

		this._sendMessage({
			_type: "start",
			payload: { vfs }
		});
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
