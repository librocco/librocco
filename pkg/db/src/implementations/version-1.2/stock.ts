import { concat, from, Observable, switchMap } from "rxjs";

import { debug, StockMap, wrapIter } from "@librocco/shared";

import { InventoryDatabaseInterface, WarehouseData, NoteData } from "./types";

import { newChangesStream } from "@/utils/pouchdb";
import { versionId } from "./utils";
import { getCreatedAt, isBookRow } from "@/utils/misc";

export interface StockInterface {
	query: (endDate?: Date) => Promise<StockMap>;
	stream: (ctx: debug.DebugCtx) => Observable<StockMap>;
	init(): Promise<void>;
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

	async init(): Promise<void> {
		// Check if archive should be updated
		const archive = await this.#db.archive().stock().get();
		const startOfCurrentMonth = new Date().toISOString().slice(0, 7);
		if (archive.month === startOfCurrentMonth) return;

		// Update the archive with stats up to beginning of the month
		const entries = await this.query(new Date(startOfCurrentMonth)).then((stock) => [...stock.rows()]);
		await this.#db.archive().stock().upsert({}, startOfCurrentMonth, entries);
	}

	async query(endDate = new Date()) {
		const queryRes = await this.#db._pouch.allDocs({ ...this.options, include_docs: true });

		const mapGenerator = wrapIter(queryRes.rows)
			.map(({ doc }) => doc as Doc)
			.filter((doc): doc is NoteData => doc?.docType === "note")
			.filter(({ committed, entries }) => Boolean(committed && entries?.length))
			.filter(filterByEndDate(endDate))
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

const filterByEndDate = (endDate: Date) => (note: NoteData) => {
	if (getCreatedAt(note._id) >= endDate) return false;
	const lastUpdate = note.committedAt || note.updatedAt;
	if (!lastUpdate) return false;
	return new Date(lastUpdate) < endDate;
};
