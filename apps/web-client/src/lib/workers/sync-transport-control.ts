import { chunks } from "@librocco/shared";
import type { Transport } from "@vlcn.io/ws-client";
import type { Changes } from "@vlcn.io/ws-common";

import type { ProgressState } from "$lib/types";

type Listener<M = undefined> = M extends undefined ? () => void : (msg: M) => void;

export class SyncEventEmitter {
	progressListeners = new Set<Listener<ProgressState>>();
	changesReceivedListeners = new Set<Listener<{ timestamp: number }>>();
	changesProcessedListeners = new Set<Listener<{ timestamp: number }>>();
	outgoingChangesListeners = new Set<Listener<{ maxDbVersion: number; changeCount: number }>>();

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
	onOutgoingChanges = this._listen(this.outgoingChangesListeners);

	notifyChangesReceived = this._notify(this.changesReceivedListeners);
	notifyChangesProcessed = this._notify(this.changesProcessedListeners);
	notifyProgress = this._notify(this.progressListeners);
	notifyOutgoingChanges = this._notify(this.outgoingChangesListeners);
}

export class ConnectionEventEmitter {
	connOpenListeners = new Set<Listener>();
	connCloseListeners = new Set<Listener>();

	private _notify = (listeners: Set<Listener>) => () => {
		for (const listener of listeners) {
			listener();
		}
	};

	private _listen = (listeners: Set<Listener>) => (cb: Listener) => {
		listeners.add(cb);
		return () => listeners.delete(cb);
	};

	onConnOpen = this._listen(this.connOpenListeners);
	onConnClose = this._listen(this.connCloseListeners);

	notifyConnOpen = this._notify(this.connOpenListeners);
	notifyConnClose = this._notify(this.connCloseListeners);
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
	#processedRecords = 0;
	#totalRecords = 0;

	#active = true;
	#running = false;

	onChunk: ((task: ChunkTask) => Promise<void>) | null = null;
	onDone: ((hadChanges: boolean, totals: { nProcessed: number; nTotal: number }) => void) | null = null;

	constructor(config: SyncConfig) {
		this.#maxChunkSize = config.maxChunkSize;
	}

	private _processQueue = async () => {
		let i = 0;
		while (i < this.#queue.length && this.#active) {
			const chunk = this.#queue[i];

			// Process chunk
			const task = { chunk, nProcessed: this.#processedRecords, nTotal: this.#totalRecords };
			await this.onChunk?.(task);

			this.#processedRecords += chunk.changes.length;
			i++;
		}

		// Cleanup
		const hadChanges = i > 0;
		const totals = { nProcessed: this.#processedRecords, nTotal: this.#totalRecords };
		this.#queue = [];
		this.#processedRecords = 0;
		this.#totalRecords = 0;
		this.#running = false;

		this.onDone?.(hadChanges, totals);
	};

	enqueue({ _tag, sender, changes, since }: Changes) {
		this.#totalRecords += changes.length;
		for (const chunk of chunks(changes, this.#maxChunkSize)) {
			this.#queue.push({ _tag, sender, changes: chunk, since });
		}

		// Start the process if not already running
		if (!this.#running) {
			this.#running = true;
			this._processQueue();
		}
	}

	start() {
		this.#active = true;
	}

	stop() {
		this.#active = false;
		this.#queue = [];
		// Only call onDone if no queue is currently running
		// If a queue is running, it will call onDone when it finishes
		if (!this.#running) {
			this.onDone?.(false, { nProcessed: 0, nTotal: 0 });
		}
	}
}

export class SyncTransportController implements Transport {
	#transport: Transport;
	#changesProcessor: ChangesProcessor;

	#progressEmitter: SyncEventEmitter;
	#connectionEmitter: ConnectionEventEmitter;
	#isConnected = false;

	announcePresence: Transport["announcePresence"];
	sendChanges: Transport["sendChanges"];
	rejectChanges: Transport["rejectChanges"];

	onChangesReceived: Transport["onChangesReceived"] = null;
	onStartStreaming: Transport["onStartStreaming"] = null;
	onResetStream: Transport["onResetStream"] = null;

	constructor(transport: Transport, progressEmitter: SyncEventEmitter, connectionEmitter: ConnectionEventEmitter, config: SyncConfig) {
		this.#transport = transport;
		this.#progressEmitter = progressEmitter;
		this.#connectionEmitter = connectionEmitter;

		// Propagate the immutable transport methods
		this.announcePresence = this.#transport.announcePresence.bind(this.#transport);
		this.sendChanges = this._sendChanges.bind(this);
		this.rejectChanges = this.#transport.rejectChanges.bind(this.#transport);
		this.close = this.#transport.close.bind(this.#transport);

		// Hijack the transport's (internal) mutable methods and expose the same interface
		// safe from override
		this.#transport.onChangesReceived = this._onChangesReceived.bind(this);
		this.#transport.onStartStreaming = this._onStartStreaming.bind(this);
		this.#transport.onResetStream = this._onResetStream.bind(this);

		// Wire up connection event handlers
		this.#transport.onConnOpen = () => {
			this.#isConnected = true;
			this.#connectionEmitter.notifyConnOpen();
		};

		this.#transport.onConnClose = () => {
			this.#isConnected = false;
			this.#connectionEmitter.notifyConnClose();
		};

		// Setup the changes processor
		this.#changesProcessor = new ChangesProcessor(config);
		this.#changesProcessor.onChunk = this._onChunk.bind(this);
		this.#changesProcessor.onDone = this._onDone.bind(this);
	}

	get isConnected() {
		return this.#isConnected;
	}

	private async _onChangesReceived(msg: Parameters<Transport["onChangesReceived"]>[0]) {
		console.log("[sync-transport] incoming batch", { len: msg.changes.length, since: msg.since });
		this.#progressEmitter.notifyProgress({ active: true, nProcessed: 0, nTotal: msg.changes.length });
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

	private _onDone(hadChanges: boolean, totals: { nProcessed: number; nTotal: number }) {
		this.#progressEmitter.notifyProgress({ active: false, nProcessed: totals.nProcessed, nTotal: totals.nTotal });
		if (hadChanges) {
			this.#progressEmitter.notifyChangesReceived({ timestamp: Date.now() });
		}
	}

	private _sendChanges(msg: Parameters<Transport["sendChanges"]>[0]) {
		const result = this.#transport.sendChanges(msg);
		if (result === "sent") {
			const maxDbVersion = msg.changes.reduce((max, change) => {
				const dbVersion = Number(change[5]);
				return dbVersion > max ? dbVersion : max;
			}, 0);
			this.#progressEmitter.notifyOutgoingChanges({ maxDbVersion, changeCount: msg.changes.length });
		}
		return result;
	}

	start(...params: Parameters<Transport["start"]>) {
		this.#changesProcessor.start();
		this.#transport.start(...params);
	}

	close() {
		this.#changesProcessor.stop();
		this.#transport.close();
	}
}

export default SyncTransportController;
