import { type Config, defaultConfig } from "ws-client-fork";
import { start } from "ws-client-fork/worker.js";

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

	const config: Config = {
		dbProvider: createDbProvider(undefined, logger),
		transportProvider: defaultConfig.transportProvider
	};

	start(config, logger);

	logger.log("[worker] started");

	self.postMessage("ready");
} catch (err) {
	logger.error("[worker] error:", err);
}
