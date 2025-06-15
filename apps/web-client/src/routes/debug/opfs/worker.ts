import { initDB, type SQLiteWrapped, type VFSKind } from "./db";

import { type WkrMsg, Tag } from "./types";
import { Logger } from "./utils";

const dbCache = new Map<string, Promise<SQLiteWrapped>>();

const logger = new Logger("worker");

logger.setLogLevel(2);

const handleRequest = async (data: WkrMsg<Tag>, resp: ResponseWriter, logger = new Logger()) => {
	logger.log("handling request", data);

	switch (data._tag) {
		case Tag.OPEN: {
			if (!dbCache.has(data._dbid)) {
				logger.log("no db found in cache, initializing new, dbid:", data._dbid);

				const _dbid = data._dbid;
				const payload = data.reqBody as { vfs: VFSKind; wasmUrl: string };

				logger.debug("payload:", payload);

				dbCache.set(
					_dbid,
					initDB(_dbid, payload.vfs, () => payload.wasmUrl)
				);

				logger.debug("db init enqueued, dbid:", _dbid);
			}

			await dbCache.get(data._dbid);
			logger.debug("db initialized, dbid:", data._dbid);

			return resp.ok(data);
		}

		case Tag.EXEC: {
			logger.log("executing SQL request", data);

			const db = await dbCache.get(data._dbid);
			logger.debug("got db:", db);

			if (!db) {
				return resp.error("Database not initialized");
			}

			// const { sql, bind } = data.reqBody as { sql: string; bind?: any[] };
			const { sql } = data.reqBody as { sql: string; bind?: any[] };
			logger.debug("SQL to execute:", sql);

			try {
				// const res = await db.exec(sql, bind);
				const res = await db.exec(sql);
				logger.log("SQL executed!");

				return resp.ok(res);
			} catch (error) {
				return resp.error(error instanceof Error ? error.message : "Unknown error");
			}
		}

		default: {
			resp.error("Unknown request type");
		}
	}
};

interface ResponseWriter {
	ok(body?: any): void;
	error(error: string): void;
}

class ResponseWriter {
	constructor(
		private readonly comm: Comm,
		private msg: WkrMsg<Tag>,
		private readonly logger = new Logger()
	) {}

	ok(body?: any) {
		this.logger.log("response Ok!");

		const msg = { ...this.msg, status: "ok", resBody: body } as WkrMsg<Tag>;
		this.logger.debug("sending response", msg);
		this.comm.postMessage(msg);
	}
	error(error: string) {
		this.logger.log("response Err!");

		const msg = { ...this.msg, status: "error", error } as WkrMsg<Tag>;
		this.logger.debug("sending response", msg);
		this.comm.postMessage({ ...this.msg, status: "error", error });
	}
}

class Comm {
	_postMessage: (msg: WkrMsg<Tag>) => void = null;

	postMessage(msg: WkrMsg<Tag>) {
		if (!this._postMessage) {
			logger.error("No postMessage handler set, cannot send message", msg);
			return;
		}

		this._postMessage(msg);
	}
}

const comm = new Comm();
comm._postMessage = (msg: WkrMsg<Tag>) => {
	self.postMessage(msg);
};

// Start the sync process
self.onmessage = (e: MessageEvent<WkrMsg<Tag>>) => {
	logger.debug("received message", e.data);

	if (!e.data?._tag) return;

	if (!e.data?._id) {
		logger.error("Received message without _id, ignoring", e.data);
	}

	const data = e.data as WkrMsg<Tag>;
	const _logger = logger.extend(e.data._id.toString());

	handleRequest(data, new ResponseWriter(comm, data, _logger), _logger);
};

self.postMessage("ready");
