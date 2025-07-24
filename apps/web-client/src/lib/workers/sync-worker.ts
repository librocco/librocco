import { type Config, defaultConfig } from "@vlcn.io/ws-client";
import { start } from "@vlcn.io/ws-client/worker.js";

// Interface to WASM sqlite
import { createDbProvider } from "@vlcn.io/ws-browserdb";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

import type { MsgStart, MsgChangesReceived, MsgChangesProcessed, MsgProgress, MsgReady } from "./types";

import { SyncTransportController, SyncEventEmitter } from "./sync-transport-control";
import type { SyncConfig } from "./sync-transport-control";

import { createVfsFactory } from "$lib/db/cr-sqlite/vfs";

type InboundMessage = MsgStart;
type OutboundMessage = MsgChangesReceived | MsgChangesProcessed | MsgProgress | MsgReady;

const MAX_SYNC_CHUNK_SIZE = 1024;

const logger = {
	log(...segments: any[]) {
		console.log("[worker]", ...segments);
	},
	warn(...segments: any[]) {
		console.warn("[worker]", ...segments);
	},
	error(...segments: any[]) {
		console.error("[worker]", ...segments);
	}
};

// Main entry point - nothing happens until the
// main thread sends a "start" message
function handleMessage(e: MessageEvent<any>) {
	// It's ok to ignore silently as a message without __kind is probably not intended to be handled here
	if (!(e as MessageEvent<InboundMessage>).data._type) return;

	const { data: msg } = e as MessageEvent<InboundMessage>;
	switch (msg._type) {
		case "start": {
			return handleStart(msg.payload);
		}
		default: {
			logger.warn("unkonwn message type:", msg._type);
		}
	}
}
self.addEventListener("message", handleMessage);

function sendMessage(msg: OutboundMessage) {
	self.postMessage(msg);
}

function handleStart(payload: MsgStart["payload"]) {
	const config: Config = {
		dbProvider: createDbProvider({
			locateWasm: () => wasmUrl,
			vfsFactory: createVfsFactory(payload.vfs)
		}),
		transportProvider: wrapProvider(defaultConfig.transportProvider, createProgressEmitter(), { maxChunkSize: MAX_SYNC_CHUNK_SIZE })
	};

	// Start the sync process
	start(config);
	self.postMessage("ready");
}

function createProgressEmitter() {
	// Emitter object
	// - emits sync events to the main thread
	// - used to monitor the sync state/progress
	const progressEmitter = new SyncEventEmitter();

	// Propagate messages from the sync process to the main thread
	progressEmitter.onChangesReceived((payload) => {
		sendMessage({ _type: "changesReceived", payload });
	});
	progressEmitter.onChangesProcessed((payload) => {
		sendMessage({ _type: "changesProcessed", payload });
	});
	progressEmitter.onProgress((payload) => {
		sendMessage({ _type: "progress", payload });
	});

	return progressEmitter;
}

type TransportProvider = Config["transportProvider"];

/**
 * See `wrapTransport` above. This merely wraps the transport provider (rather than transport itself), to
 * fit the signature (shape of the config) passed to the sync service `start` function.
 */
function wrapProvider(provider: TransportProvider, emitter: SyncEventEmitter, config: SyncConfig): TransportProvider {
	return (...params: Parameters<TransportProvider>) => new SyncTransportController(provider(...params), emitter, config);
}
