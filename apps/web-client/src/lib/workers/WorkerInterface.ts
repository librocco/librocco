import { WorkerInterface as WI } from "@vlcn.io/ws-client";

import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import type { MsgChangesProcessed, MsgChangesReceived, MsgProgress, MsgReady, MsgStart } from "./types";

import { SyncEventEmitter } from "./sync-transport-control";

type OutbounrMessage = MsgStart;
type InboundMessage = MsgChangesReceived | MsgChangesProcessed | MsgProgress | MsgReady;

export default class WorkerInterface extends WI {
	#worker: Worker;
	#emitter: SyncEventEmitter;
	#vfs: VFSWhitelist | null = null;

	constructor(worker: Worker) {
		super(worker);
		this.#worker = worker;

		this.#emitter = new SyncEventEmitter();

		this.#worker.addEventListener("message", this._handleMessage.bind(this));
	}

	private _sendMessage(msg: OutbounrMessage) {
		this.#worker.postMessage(msg);
	}

	private _handleMessage(e: MessageEvent<unknown>) {
		if (!(e as MessageEvent<InboundMessage>).data._type) return;
		const { data: msg } = e as MessageEvent<InboundMessage>;

		switch (msg._type) {
			case "changesReceived":
				this.#emitter.notifyChangesReceived(msg.payload);
				break;
			case "changesProcessed":
				this.#emitter.notifyChangesProcessed(msg.payload);
				break;
			case "progress":
				this.#emitter.notifyProgress(msg.payload);
				break;
			case "ready":
				console.log("worker initialized");
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
		return this.#emitter.onChangesReceived(cb);
	}
	onChangesProcessed(cb: (msg: { timestamp: number }) => void) {
		return this.#emitter.onChangesProcessed(cb);
	}
	onProgress(cb: (msg: { active: boolean; nProcessed: number; nTotal: number }) => void) {
		return this.#emitter.onProgress(cb);
	}
}
