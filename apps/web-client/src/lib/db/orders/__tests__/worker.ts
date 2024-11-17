import { type Config, defaultConfig } from "@vlcn.io/ws-client";
import { start } from "@vlcn.io/ws-client/worker.js";
// Interface to WASM sqlite
import { createDbProvider } from "@vlcn.io/ws-browserdb";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

export const config: Config = {
	dbProvider: createDbProvider(wasmUrl),
	transportProvider: defaultConfig.transportProvider
};

start(config);

self.postMessage("ready");
