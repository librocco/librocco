import { chunks } from "@librocco/shared";
import type { Transport } from "@vlcn.io/ws-client";
import type { Changes } from "@vlcn.io/ws-common";

type Listener<M = undefined> = M extends undefined ? () => void : (msg: M) => void;

export type SyncProgress = {
	active: boolean;
	nProcessed: number;
	nTotal: number;
};

export class SyncEventEmitter {
	progressListeners = new Set<Listener<SyncProgress>>();
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
	onProgress = this._listen(this.progressListeners);

	notifyChangesReceived = this._notify(this.changesReceivedListeners);
	notifyChangesProcessed = this._notify(this.changesProcessedListeners);
	notifyProgress = this._notify(this.progressListeners);
}

export type SyncConfig = {
	maxChunkSize: number;
};

type ChunkTask = {
	chunk: Changes;
	nProcessed: number;
	nTotal: number;
};

class ChangesProcessor {
	#maxChunkSize: number;

	#queue: Changes[] = [];
	#nProcessed = 0;

	#running = false;

	onChunk: ((task: ChunkTask) => Promise<void>) | null = null;
	onDone: (() => void) | null = null;

	constructor(config: SyncConfig) {
		this.#maxChunkSize = config.maxChunkSize;
	}

	private _processQueue = async () => {
		let i = 0;
		while (i < this.#queue.length) {
			const chunk = this.#queue[i];

			// Process chunk
			const task = { chunk, nProcessed: this.#nProcessed, nTotal: this.#queue.length };
			await this.onChunk?.(task);

			this.#nProcessed++;
			i++;
		}

		// Cleanup
		this.#queue = [];
		this.#running = false;

		this.onDone?.();
	};

	enqueue({ _tag, sender, changes, since }: Changes) {
		for (const chunk of chunks(changes, this.#maxChunkSize)) {
			this.#queue.push({ _tag, sender, changes: chunk, since });
		}

		// Start the process if not already running
		if (!this.#running) {
			this.#running = true;
			this._processQueue();
		}
	}
}

export class SyncTransportController implements Transport {
	#transport: Transport;
	#progressEmitter: SyncEventEmitter;
	#changesProcessor: ChangesProcessor;

	start: Transport["start"];
	announcePresence: Transport["announcePresence"];
	sendChanges: Transport["sendChanges"];
	rejectChanges: Transport["rejectChanges"];

	onChangesReceived: Transport["onChangesReceived"] = null;
	onStartStreaming: Transport["onStartStreaming"] = null;
	onResetStream: Transport["onResetStream"] = null;

	close: Transport["close"];

	constructor(transport: Transport, progressEmitter: SyncEventEmitter, config: SyncConfig) {
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

		// Setup the changes processor
		this.#changesProcessor = new ChangesProcessor(config);
		this.#changesProcessor.onChunk = this._onChunk.bind(this);
		this.#changesProcessor.onDone = this._onDone.bind(this);
	}

	private async _onChangesReceived(msg: Parameters<Transport["onChangesReceived"]>[0]) {
		this.#changesProcessor.enqueue(msg);
	}

	private _onStartStreaming(msg: Parameters<Transport["onStartStreaming"]>[0]) {
		this.onStartStreaming?.(msg);
	}

	private _onResetStream(msg: Parameters<Transport["onResetStream"]>[0]) {
		this.onResetStream?.(msg);
	}

	private async _onChunk({ chunk, nProcessed, nTotal }: ChunkTask) {
		this.#progressEmitter.notifyProgress({ active: true, nProcessed, nTotal });
		await this.onChangesReceived?.(chunk);
	}

	private _onDone() {
		this.#progressEmitter.notifyProgress({ active: false, nProcessed: 0, nTotal: 0 });
	}
}

export default SyncTransportController;
