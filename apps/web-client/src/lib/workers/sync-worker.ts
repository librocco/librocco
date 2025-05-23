import { type Config, defaultConfig } from "@vlcn.io/ws-client";
import { start } from "@vlcn.io/ws-client/worker.js";

// Interface to WASM sqlite
import { createDbProvider } from "@vlcn.io/ws-browserdb";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

import { SyncTransportController, TransportEventEmitter } from "./sync-transport-control";

// Emitter object
// - emits sync events to the main thread
// - used to monitor the sync state/progress
const progressEmitter = new TransportEventEmitter();

// Propagate messages from the sync process to the main thread
progressEmitter.onChangesReceived((payload) => {
	self.postMessage({ _type: "changesReceived", payload });
});
progressEmitter.onChangesProcessed((payload) => {
	self.postMessage({ _type: "changesProcessed", payload });
});
progressEmitter.onStartStreaming((payload) => {
	self.postMessage({ _type: "startStreaming", payload });
});
progressEmitter.onResetStream((payload) => {
	self.postMessage({ _type: "resetStream", payload });
});

const config: Config = {
	dbProvider: createDbProvider(wasmUrl),
	transportProvider: wrapProvider(defaultConfig.transportProvider, progressEmitter)
};

// Start the sync process
start(config);

self.postMessage("ready");

type TransportProvider = Config["transportProvider"];

/**
 * See `wrapTransport` above. This merely wraps the transport provider (rather than transport itself), to
 * fit the signature (shape of the config) passed to the sync service `start` function.
 */
function wrapProvider(provider: TransportProvider, emitter: TransportEventEmitter): TransportProvider {
	return (...params: Parameters<TransportProvider>) => new SyncTransportController(provider(...params), emitter);
}
