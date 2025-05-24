import type { Transport } from "@vlcn.io/ws-client";

type Listener<M = undefined> = M extends undefined ? () => void : (msg: M) => void;

export class SyncEventEmitter {
	changesReceivedListeners = new Set<Listener<{ timestamp: number }>>();
	changesProcessedListeners = new Set<Listener<{ timestamp: number }>>();

	private _notify =
		<M>(listeners: Set<Listener<M>>) =>
		(msg: M) => {
			for (const listener of listeners) {
				listener(msg);
			}
		};

	private _listen =
		<M>(listeners: Set<Listener<M>>) =>
		(cb: Listener<M>) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		};

	onChangesReceived = this._listen(this.changesReceivedListeners);
	onChangesProcessed = this._listen(this.changesProcessedListeners);

	notifyChangesReceived = this._notify(this.changesReceivedListeners);
	notifyChangesProcessed = this._notify(this.changesProcessedListeners);
}

export class SyncTransportController implements Transport {
	#transport: Transport;
	#progressEmitter: SyncEventEmitter;

	start: Transport["start"];
	announcePresence: Transport["announcePresence"];
	sendChanges: Transport["sendChanges"];
	rejectChanges: Transport["rejectChanges"];

	onChangesReceived: Transport["onChangesReceived"] = null;
	onStartStreaming: Transport["onStartStreaming"] = null;
	onResetStream: Transport["onResetStream"] = null;

	close: Transport["close"];

	constructor(transport: Transport, progressEmitter: SyncEventEmitter) {
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
		const timestamp = Date.now();
		this.#progressEmitter.notifyChangesReceived({ timestamp });
		await this.onChangesReceived?.(msg);
		this.#progressEmitter.notifyChangesProcessed({ timestamp });
	}

	private _onStartStreaming(msg: Parameters<Transport["onStartStreaming"]>[0]) {
		this.onStartStreaming?.(msg);
	}

	private _onResetStream(msg: Parameters<Transport["onResetStream"]>[0]) {
		this.onResetStream?.(msg);
	}
}

export default SyncTransportController;
