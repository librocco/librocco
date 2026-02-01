import { type Config, defaultConfig } from "@vlcn.io/ws-client";
import { start } from "@vlcn.io/ws-client/worker.js";

// Interface to WASM sqlite
import { createDbProvider } from "@vlcn.io/ws-browserdb";

import type {
	MsgStart,
	MsgChangesReceived,
	MsgChangesProcessed,
	MsgProgress,
	MsgReady,
	MsgConnectionOpen,
	MsgConnectionClose,
	MsgOutgoingChanges
} from "./types";

import { SyncTransportController, ConnectionEventEmitter, SyncEventEmitter } from "./sync-transport-control";
import type { SyncConfig } from "./sync-transport-control";

import { createVFSFactory } from "$lib/db/cr-sqlite/core";
import { createWasmInitializer } from "@vlcn.io/crsqlite-wasm";
import { getWasmBuildArtefacts } from "$lib/db/cr-sqlite/core/init";

type InboundMessage = MsgStart;
type OutboundMessage =
	| MsgChangesReceived
	| MsgChangesProcessed
	| MsgProgress
	| MsgReady
	| MsgConnectionOpen
	| MsgConnectionClose
	| MsgOutgoingChanges;

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
	// Get WASM build artefacts for appropriate VFS + WASM build
	const wasmBuildArtefacts = getWasmBuildArtefacts(payload.vfs);
	const { wasmUrl, getModule } = wasmBuildArtefacts;

	// Wrap DB provider, to flatten the promise to DB initialization
	//
	// dbProvider is async in and of itself, so we can include dynamic module fetching
	// and async initializations there.
	//
	// In theory, we could retrieve the ModuleFactory beforehand, but making the outer
	// function (handleStart) async breaks the sync initialization (the worker gets initialized, but no sync takes place).
	// This is a convenient, and somewhat clean workaround (we might cache the ModuleFactory to make it fully kosher).
	const dbProvider: Config["dbProvider"] = async (dbname: string) => {
		const { vfs } = payload;

		const ModuleFactory = await getModule();
		const vfsFactory = createVFSFactory(vfs);
		// We're using the vfs as cache key as it includes all information
		// about the module: `${build}-${vfs}`
		const cacheKey = vfs;

		const initializer = createWasmInitializer({ ModuleFactory, vfsFactory, cacheKey });

		const provider = createDbProvider(wasmUrl, initializer);

		return provider(dbname);
	};

	const config: Config = {
		dbProvider,
		transportProvider: wrapTransportProvider(defaultConfig.transportProvider, createProgressEmitter(), createConnectionEventEmitter(), {
			maxChunkSize: MAX_SYNC_CHUNK_SIZE
		})
	};

	// Start the sync process
	start(config);

	// IMPORTANT: without this message the sync won't ever initialise on client side
	sendMessage({ _type: "ready", payload: null });
}

function createProgressEmitter() {
	// Emitter object
	// - emits sync events to the main thread
	// - used to monitor the sync state/progress
	const progressEmitter = new SyncEventEmitter();

	// Propagate messages from the sync process to the main thread
	progressEmitter.onChangesReceived((payload) => {
		console.log("[sync-worker] changes received", payload);
		sendMessage({ _type: "changesReceived", payload });
	});
	progressEmitter.onChangesProcessed((payload) => {
		sendMessage({ _type: "changesProcessed", payload });
	});
	progressEmitter.onProgress((payload) => {
		console.log("[sync-worker] progress", payload);
		sendMessage({ _type: "progress", payload });
	});
	progressEmitter.onOutgoingChanges((payload) => {
		sendMessage({ _type: "outgoingChanges", payload });
	});

	return progressEmitter;
}

function createConnectionEventEmitter() {
	// Emitter object
	// - emits sync events to the main thread
	// - used to monitor the sync state/progress
	const connectionEventEmitter = new ConnectionEventEmitter();

	connectionEventEmitter.onConnOpen(() => {
		sendMessage({ _type: "connection.open", payload: null });
	});
	connectionEventEmitter.onConnClose(() => {
		sendMessage({ _type: "connection.close", payload: null });
	});

	return connectionEventEmitter;
}

type TransportProvider = Config["transportProvider"];

/**
 * Wraps a transport provider to inject the SyncTransportController (passing `emitter` and `config` to it), allowing
 * the transport to emit sync events via the emitter.
 * @param provider The original transport provider
 * @param emitter The sync event emitter (passed to wrapped SyncTransportController)
 * @param config
 * @returns A wrapped transport provider
 */
function wrapTransportProvider(
	provider: TransportProvider,
	progressEmitter: SyncEventEmitter,
	connectionEmitter: ConnectionEventEmitter,
	config: SyncConfig
): TransportProvider {
	return (...params: Parameters<TransportProvider>) =>
		new SyncTransportController(provider(...params), progressEmitter, connectionEmitter, config);
}
