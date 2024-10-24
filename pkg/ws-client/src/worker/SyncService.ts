import { createAndStartSyncedDB_Exclusive } from "../SyncedDB.js";
import { Config } from "../config.js";
import { type WLogger, defaultLogger } from "./logger.js";
import { StartSyncMsg, StopSyncMsg } from "./workerMsgTypes.js";

/**
 * There should be one instance of this class per application.
 * Create this instance outside of the React lifecylce (if you're using React).
 *
 * Do we need this class?
 */
export default class SyncService {
	/**
	 * Map from dbid to SyncedDB
	 */
	private readonly dbs = new Map<
		string,
		ReturnType<typeof createAndStartSyncedDB_Exclusive>
	>();

	constructor(private config: Config, private logger: WLogger = defaultLogger) { }

	async startSync(msg: StartSyncMsg) {
		try {
			this.logger.log("[worker:sync_service:start_sync]", "dbid:", msg.dbid)
			const entry = this.dbs.get(msg.dbid);
			if (!entry) {
				const creator = createAndStartSyncedDB_Exclusive(
					this.config,
					msg.dbid,
					msg.transportOpts,
					this.logger
				);
				this.dbs.set(msg.dbid, creator);
				await creator;
			} else {
				this.logger.log("[worker:sync_service:start_sync]", "already syncing db:", msg.dbid)
				console.warn(`Already syncing db: ${msg.dbid}`);
				return;
			}
		} catch (err) {
			this.logger.error("[worker:sync_service:start_sync]", "error:", err)
		}
	}

	async stopSync(msg: StopSyncMsg) {
		this.logger.log("[worker:sync_service:stop_sync]", "dbid:", msg.dbid)
		// decrement reference count for the given db
		// if reference count is 0, stop sync for that db
		// TODO: can we understand when message ports close due to browser tab closing?
		// If we send a msg on a closed channel do we just get an error?
		const handle = this.dbs.get(msg.dbid);
		if (handle) {
			this.dbs.delete(msg.dbid);
			const db = await handle;
			db.stop();
		}
	}
}
