import { WorkerInterface as WI } from "@vlcn.io/ws-client";
import type { Changes, StartStreaming } from "@vlcn.io/ws-common";

import { TransportEventEmitter } from "./utils";

type ChangesReceivedData = {
	_type: "changesReceived";
	payload: Changes;
};
type ChangesProcessedData = {
	_type: "changesProcessed";
	payload: { ok: boolean };
};
type StartStreamingdData = {
	_type: "startStreaming";
	payload: StartStreaming;
};
type ResetStreamData = {
	_type: "resetStream";
	payload: StartStreaming;
};

type TransportEventData = ChangesReceivedData | ChangesProcessedData | StartStreamingdData | ResetStreamData;

const isTransportMessageEvent = (e: MessageEvent<unknown>): e is MessageEvent<TransportEventData> => {
	if (!(e.data as any)?._type) return false;
	const data = e.data as { _type: string };
	console.log("data", e.data);

	return ["changesReceived", "changesProcessed", "startStreaming", "resetStream"].includes(data._type);
};

export default class WorkerInterface extends WI {
	#worker: Worker;
	#emitter: TransportEventEmitter;

	constructor(worker: Worker) {
		super(worker);
		this.#worker = worker;

		this.#emitter = new TransportEventEmitter();

		this.#worker.addEventListener("message", this._handleMessage.bind(this));
	}

	private _handleMessage(e: MessageEvent<unknown>) {
		console.log("received message", e.data);
		if (!isTransportMessageEvent(e)) return;
		console.log("is transport message event", isTransportMessageEvent(e));

		switch (e.data._type) {
			case "changesReceived":
				this.#emitter.notifyChangesReceived(e.data.payload);
				break;
			case "changesProcessed":
				this.#emitter.notifyChangesProcessed(e.data.payload);
				break;
			case "startStreaming":
				this.#emitter.notifyStartStreaming(e.data.payload);
				break;
			case "resetStream":
				this.#emitter.notifyResetStream(e.data.payload);
				break;
		}
	}

	onChangesReceived(cb: (msg: Changes) => void) {
		return this.#emitter.onChangesReceived(cb);
	}
	onChangesProcessed(cb: (msg: { ok: boolean }) => void) {
		return this.#emitter.onChangesProcessed(cb);
	}
	onStartStreaming(cb: (msg: StartStreaming) => void) {
		return this.#emitter.onStartStreaming(cb);
	}
	onResetStream(cb: (msg: StartStreaming) => void) {
		return this.#emitter.onResetStream(cb);
	}
}
