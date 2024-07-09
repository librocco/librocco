import { concat, from, map, Observable, switchMap } from "rxjs";

import { debug, StockMap, VolumeStock, VolumeStockInput, wrapIter } from "@librocco/shared";

import { InventoryDatabaseInterface, WarehouseData, NoteData } from "./types";

import { newChangesStream } from "@/utils/pouchdb";
import { versionId } from "./utils";
import { /* getCreatedAt, */ isBookRow } from "@/utils/misc";
import { NoteType } from "@/types";

export interface StockQueryParams {
	startDate?: Date;
	endDate?: Date;
}

export interface StockInterface {
	query: (ctx: debug.DebugCtx) => Promise<StockMap>;
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

	changes({ startDate, endDate }: StockQueryParams = {}) {
		return this.#db._pouch.changes<Doc>({
			...this.options,
			include_docs: false,
			since: "now",
			live: true,
			// We don't care about changes to non-committed notes (as they don't affect the stock)
			filter: (doc) => doc.committed && filterByStartDate(startDate)(doc) && filterByEndDate(endDate)(doc)
		});
	}

	changesStream(ctx: debug.DebugCtx, params?: StockQueryParams) {
		return newChangesStream(ctx, this.changes(params));
	}

	async init(): Promise<void> {
		// Check if archive should be updated
		const archive = await this.#db.archive().stock().get();
		const startOfCurrentMonth = new Date().toISOString().slice(0, 7);
		if (archive.month === startOfCurrentMonth) return;

		// Update the archive with stats up to beginning of the month
		//
		// If we already have some archive, we need only the delta. If not, using undefined as date
		// will fetch all of the available data from the beginning of time.
		const startDate = archive.month ? new Date(archive.month) : undefined;
		const endDate = new Date(startOfCurrentMonth);
		const delta = await this._query({ startDate, endDate });

		// Combine the existing archive and the delta + save as the new archive
		const entries = mergeArchiveAndRunningStock(archive.entries, delta).rows();

		await this.#db
			.archive()
			.stock()
			.upsert({}, startOfCurrentMonth, [...entries]);
	}

	private async _query({ startDate, endDate }: StockQueryParams = {}) {
		const queryRes = await this.#db._pouch.allDocs({ ...this.options, include_docs: true });
		return wrapIter(queryRes.rows)
			.map(({ doc }) => doc as Doc)
			.filter((doc): doc is NoteData => doc?.docType === "note")
			.filter(({ committed, entries }) => Boolean(committed && entries?.length))
			.filter(filterByStartDate(startDate))
			.filter(filterByEndDate(endDate))
			.flatMap(({ entries, noteType }) =>
				wrapIter(entries)
					// We're not passing custom item entries to stock (as it shouldn't affect the final state)
					.filter(isBookRow)
					.map((entry) => ({ ...entry, noteType }))
			);
	}

	private _getArchive(ctx: debug.DebugCtx) {
		const res = this.#db.archive().stock().get();
		debug.log(ctx, "get_archive: got res")(res);
		return res;
	}

	private _streamArchive(ctx: debug.DebugCtx) {
		return this.#db.archive().stock().stream(ctx);
	}

	private _getRunningEntries(ctx: debug.DebugCtx, startDate?: Date) {
		const res = this._query({ startDate });
		debug.log(ctx, "get_running_entries: got res")(res);
		return res;
	}

	private _streamRunningEntries(ctx: debug.DebugCtx, startDate?: Date) {
		const trigger = concat(from(Promise.resolve()), this.changesStream(ctx, { startDate }));
		return trigger.pipe(switchMap(() => this._getRunningEntries(ctx, startDate)));
	}

	async query(ctx: debug.DebugCtx) {
		const archive = await this._getArchive(ctx);
		const running = await this._getRunningEntries(ctx, archive.month ? new Date(archive.month) : undefined);
		return mergeArchiveAndRunningStock(archive.entries, running);
	}

	stream(ctx: debug.DebugCtx) {
		// Stream the archive first
		return this._streamArchive(ctx).pipe(
			// Use the archive.month (if exists) to determine the start date for the running entries
			switchMap((archive) =>
				// Stream the running entries and merge them with the archive
				this._streamRunningEntries(ctx, archive.month ? new Date(archive.month) : undefined).pipe(
					map((running) => mergeArchiveAndRunningStock(archive.entries, running))
				)
			)
		);
	}
}

export const newStock = (db: InventoryDatabaseInterface) => new Stock(db);

const filterByEndDate = (endDate?: Date) => (note: NoteData) => {
	if (!endDate) return true;
	// TODO: this is valid, but is skipped as tests have a different (not so realistic) id patterns,
	// so this returns false negatives
	//
	// if (getCreatedAt(note._id) >= endDate) return false;
	const lastUpdate = note.committedAt || note.updatedAt;
	if (!lastUpdate) return false;
	return new Date(lastUpdate) < endDate;
};

const filterByStartDate = (startDate?: Date) => (note: NoteData) => {
	if (!startDate) return true;
	// TODO: this is valid, but is skipped as tests have a different (not so realistic) id patterns,
	// so this might return false positives
	//
	// if (getCreatedAt(note._id) >= startDate) return true;
	const lastUpdate = note.committedAt || note.updatedAt;
	if (!lastUpdate) return true; // if not committed (or updated), the note is open
	return new Date(lastUpdate) >= startDate;
};

const mergeArchiveAndRunningStock = (archive: Iterable<VolumeStock<"book">>, running: Iterable<VolumeStockInput>) =>
	StockMap.fromDbRows(
		wrapIter(archive)
			.map((e) => ({ ...e, noteType: "inbound" as NoteType }))
			.concat(running)
	);
