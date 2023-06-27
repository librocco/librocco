import { debug } from "@librocco/shared";

import { Replicator } from "@/types";
import { DatabaseInterface } from "./types";

import { logReplication, promisifyReplication } from "@/utils/pouchdb";

export class DbReplicator implements Replicator {
	#db: DatabaseInterface;

	constructor(db: DatabaseInterface) {
		this.#db = db;
	}

	to(ctx: debug.DebugCtx, url: string) {
		const replication = logReplication(ctx, this.#db._pouch.name, url)(this.#db._pouch.replicate.to(url));
		return {
			replication,
			/**
			 * @TODO After the replication is done, the db still needs time to build the views,
			 * update the 'resolver' part of the replication promise to take that into account, rather than just resolving.
			 */
			promise: () => promisifyReplication(ctx, replication, () => Promise.resolve())
		};
	}

	from(ctx: debug.DebugCtx, url: string) {
		const replication = logReplication(ctx, this.#db._pouch.name, url)(this.#db._pouch.replicate.from(url));
		return {
			replication,
			/**
			 * @TODO After the replication is done, the db still needs time to build the views,
			 * update the 'resolver' part of the replication promise to take that into account, rather than just resolving.
			 */
			promise: () => promisifyReplication(ctx, replication, () => Promise.resolve())
		};
	}

	sync(ctx: debug.DebugCtx, url: string) {
		const replication = logReplication(ctx, this.#db._pouch.name, url)(this.#db._pouch.sync(url, { live: false }));
		return {
			replication,
			/**
			 * @TODO After the replication is done, the db still needs time to build the views,
			 * update the 'resolver' part of the replication promise to take that into account, rather than just resolving.
			 */
			promise: () => promisifyReplication(ctx, replication, () => Promise.resolve())
		};
	}

	live(ctx: debug.DebugCtx, url: string) {
		const replication = logReplication(ctx, this.#db._pouch.name, url)(this.#db._pouch.sync(url, { live: true, retry: true }));
		return {
			replication,
			promise: () => Promise.resolve()
		};
	}
}

export const newDbReplicator = (db: DatabaseInterface) => new DbReplicator(db);
