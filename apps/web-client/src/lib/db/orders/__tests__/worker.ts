import { type Config, defaultConfig } from "ws-client-fork";
import { start } from "ws-client-fork/worker.js";
// Interface to WASM sqlite
import { createDbProvider } from "@vlcn.io/ws-browserdb";

const formatLog = (...params: any[]) => params.map(String).join(" ")

const logger = {
	log: (...params: any[]) => self.postMessage({ log: formatLog(...params) }),
	error: (...params: any[]) => self.postMessage({ error: formatLog(...params) })
}

export const config: Config = {
	dbProvider: createDbProvider(),
	transportProvider: defaultConfig.transportProvider
};

start(config, logger);

logger.log("Worker started")
