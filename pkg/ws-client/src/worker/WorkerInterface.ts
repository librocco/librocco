import { TransporOptions } from "../transport/Transport.js";
import { DBID } from "../types.js";
import { StartSyncMsg, StopSyncMsg } from "./workerMsgTypes.js";

console.log("here")

export default class WorkerInterface {
	readonly #worker;
	readonly #syncs = new Set<DBID>();

	constructor(worker: Worker) {
		console.log("constructed a wrkr")
		this.#worker = worker;
	}

	startSync(dbid: DBID, transportOpts: TransporOptions) {
		console.log("starting sync...")
		if (this.#syncs.has(dbid)) {
			throw new Error(`Already syncing ${dbid}`);
		}

		this.#syncs.add(dbid);
		this.#worker.postMessage({
			_tag: "StartSync",
			dbid,
			transportOpts,
		} satisfies StartSyncMsg);
	}

	stopSync(dbid: DBID) {
		this.#worker.postMessage({
			_tag: "StopSync",
			dbid,
		} satisfies StopSyncMsg);
		this.#syncs.delete(dbid);
	}
}
