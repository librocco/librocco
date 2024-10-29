import { type Config,  WebSocketTransport } from "ws-client-fork";
import { start } from "ws-client-fork/worker.js";

import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

const formatLog = (...params: any[]) => params.map(String).join(" ");

const logger = {
	log: (...params: any[]) => self.postMessage({ log: formatLog(...params) }),
	error: (...params: any[]) => self.postMessage({ error: formatLog(...params) })
};

try {
	logger.log("[worker]", "importing browserdb...");
	const bdb = await import("ws-browserdb-fork");
	const { createDbProvider } = bdb;
	logger.log("[worker]", "got browserdb");

	const transportProvider: Config["transportProvider"] = (opts) => new WebSocketTransport(opts, logger)

	const config: Config = {
		dbProvider: createDbProvider(wasmUrl, logger),
		transportProvider
	};

	start(config, logger);

	logger.log("[worker] started");

	self.postMessage("ready");
} catch (err) {
	logger.error("[worker] error:", err);
}
