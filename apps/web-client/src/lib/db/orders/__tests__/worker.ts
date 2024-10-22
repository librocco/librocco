import { type Config, defaultConfig } from "@vlcn.io/ws-client";
import { start } from "@vlcn.io/ws-client/worker.js";
// Interface to WASM sqlite
import { createDbProvider } from "@vlcn.io/ws-browserdb";

export const config: Config = {
	dbProvider: createDbProvider(),
	transportProvider: defaultConfig.transportProvider
};

self.postMessage({ log: "Hello from the worker!" });

start(config);
