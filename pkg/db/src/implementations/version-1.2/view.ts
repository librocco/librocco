import { concat, from, switchMap } from "rxjs";

import { debug } from "@librocco/shared";

import type { ViewInterface } from "./types";
import { CouchDocument, MapReduceRes, MapReduceRow } from "@/types";

import { newChangesStream } from "@/utils/pouchdb";

class View<R extends MapReduceRow, M extends CouchDocument = CouchDocument> implements ViewInterface<R, M> {
	#db: PouchDB.Database;
	name: string;

	constructor(db: PouchDB.Database, name: string) {
		this.#db = db;
		this.name = name;
	}

	// eslint-disable-next-line @typescript-eslint/ban-types
	query(opts?: PouchDB.Query.Options<M, R>) {
		return this.#db.query<R, M>(this.name, opts) as unknown as Promise<MapReduceRes<R, M>>;
	}

	changes(opts: PouchDB.Core.ChangesOptions = {}) {
		return this.#db.changes<M>({
			since: "now",
			live: true,
			filter: "_view",
			view: this.name,
			...opts
		});
	}

	changesStream(ctx: debug.DebugCtx, opts?: PouchDB.Core.ChangesOptions) {
		return newChangesStream(ctx, this.changes(opts));
	}

	stream(ctx: debug.DebugCtx, opts?: PouchDB.Query.Options<M, R>) {
		return concat(
			// Stream once to trigger initial state query
			from(Promise.resolve()),
			// Stream on change
			this.changesStream(ctx, opts)
		).pipe(
			// Each stream (from above) serves as a trigger to query the view again (to stream the entire updated state).
			switchMap(() => this.query(opts))
		);
	}
}

export const newView = <R extends MapReduceRow, M extends CouchDocument = CouchDocument>(
	db: PouchDB.Database,
	name: string
): ViewInterface<R, M> => new View<R, M>(db, name);
