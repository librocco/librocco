import { WorkerInterface as WI } from "@vlcn.io/ws-client";

import { SyncEventEmitter } from "./sync-transport-control";

type ChangesReceivedData = {
	_type: "changesReceived";
	payload: { timestamp: number };
};
type ChangesProcessedData = {
	_type: "changesProcessed";
	payload: { timestamp: number };
};

type TransportEventData = ChangesReceivedData | ChangesProcessedData;

const isTransportMessageEvent = (e: MessageEvent<unknown>): e is MessageEvent<TransportEventData> => {
	if (!(e.data as any)?._type) return false;
	const data = e.data as { _type: string };

	return ["changesReceived", "changesProcessed", "startStreaming", "resetStream"].includes(data._type);
};

export default class WorkerInterface extends WI {
	#worker: Worker;
	#emitter: SyncEventEmitter;

	constructor(worker: Worker) {
		super(worker);
		this.#worker = worker;

		this.#emitter = new SyncEventEmitter();

		this.#worker.addEventListener("message", this._handleMessage.bind(this));
	}

	private _handleMessage(e: MessageEvent<unknown>) {
		if (!isTransportMessageEvent(e)) return;

		switch (e.data._type) {
			case "changesReceived":
				this.#emitter.notifyChangesReceived(e.data.payload);
				break;
			case "changesProcessed":
				this.#emitter.notifyChangesProcessed(e.data.payload);
				break;
		}
	}

	onChangesReceived(cb: (msg: { timestamp: number }) => void) {
		return this.#emitter.onChangesReceived(cb);
	}
	onChangesProcessed(cb: (msg: { timestamp: number }) => void) {
		return this.#emitter.onChangesProcessed(cb);
	}
}
