import { Replicator } from "@/types";
import { BaseDatabaseInterface } from "./types";

export class DbReplicator implements Replicator {
	#db: BaseDatabaseInterface;

	constructor(db: BaseDatabaseInterface) {
		this.#db = db;
	}

	to(url: string | PouchDB.Database, options: PouchDB.Replication.ReplicateOptions) {
		return this.#db._pouch.replicate.to(url, options);
	}

	from(url: string | PouchDB.Database, options: PouchDB.Replication.ReplicateOptions) {
		return this.#db._pouch.replicate.from(url, options);
	}

	sync(url: string | PouchDB.Database, options: PouchDB.Replication.ReplicateOptions) {
		return this.#db._pouch.sync(url, options);
	}
}

export const newDbReplicator = (db: BaseDatabaseInterface) => new DbReplicator(db);
