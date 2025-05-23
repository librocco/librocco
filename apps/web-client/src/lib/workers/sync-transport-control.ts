import type { Transport } from "@vlcn.io/ws-client";
import type { Changes, StartStreaming } from "@vlcn.io/ws-common";

type TransportListener<M> = (msg: M) => void;

export class TransportEventEmitter {
	changesReceivedListeners = new Set<TransportListener<Changes>>();
	changesProcessedListeners = new Set<TransportListener<{ ok: boolean }>>();
	startStreamingListeners = new Set<TransportListener<StartStreaming>>();
	resetStreamListeners = new Set<TransportListener<StartStreaming>>();

	private _notify =
		<M>(listeners: Set<TransportListener<M>>) =>
		(msg: M) => {
			for (const listener of listeners) {
				listener(msg);
			}
		};

	private _listen =
		<M>(listeners: Set<TransportListener<M>>) =>
		(cb: TransportListener<M>) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		};

	onChangesReceived = this._listen(this.changesReceivedListeners);
	onChangesProcessed = this._listen(this.changesProcessedListeners);
	onStartStreaming = this._listen(this.startStreamingListeners);
	onResetStream = this._listen(this.resetStreamListeners);

	notifyChangesReceived = this._notify(this.changesReceivedListeners);
	notifyChangesProcessed = this._notify(this.changesProcessedListeners);
	notifyStartStreaming = this._notify(this.startStreamingListeners);
	notifyResetStream = this._notify(this.resetStreamListeners);
}

export class SyncTransportController implements Transport {
	#transport: Transport;
	#progressEmitter: TransportEventEmitter;

	start: Transport["start"];
	announcePresence: Transport["announcePresence"];
	sendChanges: Transport["sendChanges"];
	rejectChanges: Transport["rejectChanges"];

	onChangesReceived: Transport["onChangesReceived"] = null;
	onStartStreaming: Transport["onStartStreaming"] = null;
	onResetStream: Transport["onResetStream"] = null;

	close: Transport["close"];

	constructor(transport: Transport, progressEmitter: TransportEventEmitter) {
		this.#transport = transport;
		this.#progressEmitter = progressEmitter;

		// Propagate the immutable transport methods
		this.start = this.#transport.start.bind(this.#transport);
		this.announcePresence = this.#transport.announcePresence.bind(this.#transport);
		this.sendChanges = this.#transport.sendChanges.bind(this.#transport);
		this.rejectChanges = this.#transport.rejectChanges.bind(this.#transport);
		this.close = this.#transport.close.bind(this.#transport);

		// Hijack the transport's (internal) mutable methods and expose the same interface
		// safe from override
		this.#transport.onChangesReceived = this._onChangesReceived.bind(this);
		this.#transport.onStartStreaming = this._onStartStreaming.bind(this);
		this.#transport.onResetStream = this._onResetStream.bind(this);
	}

	private async _onChangesReceived(msg: Parameters<Transport["onChangesReceived"]>[0]) {
		this.#progressEmitter.notifyChangesReceived(msg);
		await this.#transport.onChangesReceived?.(msg);
		this.#progressEmitter.notifyChangesProcessed({ ok: true });
	}
	private _onStartStreaming(msg: Parameters<Transport["onStartStreaming"]>[0]) {
		this.#progressEmitter.notifyStartStreaming(msg);
		this.#transport.onStartStreaming?.(msg);
	}
	private _onResetStream(msg: Parameters<Transport["onResetStream"]>[0]) {
		this.#progressEmitter.notifyResetStream(msg);
		this.#transport.onResetStream?.(msg);
	}
}

export default SyncTransportController;
