import { concat, from, Observable, switchMap } from "rxjs";

import { debug, StockMap, wrapIter } from "@librocco/shared";

import { InventoryDatabaseInterface, WarehouseData, NoteData } from "./types";

import { newChangesStream, versionId } from "./utils";
import { isBookRow } from "@/utils/misc";

export interface StockInterface {
	changes: () => PouchDB.Core.Changes<any>;
	query: () => Promise<StockMap>;
	stream: (ctx: debug.DebugCtx) => Observable<StockMap>;
}

type Doc = NoteData | WarehouseData;

class Stock implements StockInterface {
	#db: InventoryDatabaseInterface;

	options: PouchDB.Core.AllDocsWithinRangeOptions;

	constructor(db: InventoryDatabaseInterface) {
		this.#db = db;

		// Start from "v1/" (to collect the outbound notes, belonging to the default warehouse)
		const startkey = versionId("");
		// End with "v10" (as '0' is the next lexical character after '/'), ending the 'v1/' namespace
		const endkey = startkey.replace(/.$/, (c) => String.fromCharCode(c.charCodeAt(0) + 1));
		this.options = {
			startkey,
			endkey
		};
	}

	changes() {
		return this.#db._pouch.changes<Doc>({
			...this.options,
			include_docs: false,
			since: "now",
			live: true,
			// We don't care about changes to non-committed notes (as they don't affect the stock)
			filter: (doc) => doc.committed
		});
	}

	changesStream(ctx: debug.DebugCtx) {
		return newChangesStream(ctx, this.changes());
	}

	async query() {
		const queryRes = await this.#db._pouch.allDocs({ ...this.options, include_docs: true });

		const mapGenerator = wrapIter(queryRes.rows)
			.map(({ doc }) => doc as Doc)
			.filter((doc): doc is NoteData => doc?.docType === "note")
			.filter(({ committed, entries }) => Boolean(committed && entries?.length))
			.flatMap(({ entries, noteType }) =>
				wrapIter(entries)
					// We're not passing custom item entries to stock (as it shouldn't affect the final state)
					.filter(isBookRow)
					.map((entry) => ({ ...entry, noteType }))
			);

		return StockMap.fromDbRows(mapGenerator);
	}
	async getAll() {
		const queryRes = await this.#db._pouch.allDocs({ ...this.options, include_docs: true });

		return wrapIter(queryRes.rows)
			.map(({ doc }) => doc as Doc)
			.filter((doc): doc is NoteData => doc?.docType === "note")
			.filter(({ committed, entries }) => Boolean(committed && entries?.length))
			.flatMap(({ entries, committedAt, noteType }) => wrapIter(entries).map((entry) => ({ ...entry, committedAt, noteType })))
			.array();
	}

	stream(ctx: debug.DebugCtx) {
		const trigger = concat(from(Promise.resolve()), this.changesStream(ctx));
		return trigger.pipe(switchMap(() => this.query()));
	}
}

export const newStock = (db: InventoryDatabaseInterface) => new Stock(db);
