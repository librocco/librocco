import { switchMap, combineLatest, map, tap } from "rxjs";
import { readable, type Readable } from "svelte/store";

import { debug, wrapIter, zip, reduce } from "@librocco/shared";
import type { BookEntry, InventoryDatabaseInterface } from "@librocco/db";

import type { BookHistoryStores, DailySummaryStore, PastNoteEntry } from "$lib/types/inventory";
import { readableFromStream } from "$lib/utils/streams";
import { mapMergeBookWarehouseData } from "$lib/utils/misc";

interface CreateDailySummaryStore {
	(ctx: debug.DebugCtx, db: InventoryDatabaseInterface | undefined, date?: string): Readable<DailySummaryStore>;
}

export const createDailySummaryStore: CreateDailySummaryStore = (ctx, db, date) => {
	if (!db || !date) {
		return readable({} as DailySummaryStore);
	}

	const pastTransactionsStream = db
		.history()
		.stream(ctx)
		.pipe(map((pt) => pt.by("date")));
	const warehouseMapStream = db.stream().warehouseMap(ctx);

	const dailySummary = pastTransactionsStream.pipe(
		switchMap((txnMap) => {
			const entries = [...(txnMap.get(date) || [])];
			const isbns = entries.map(({ isbn }) => isbn);

			return db.books().stream(ctx, isbns).pipe(mapMergeBookWarehouseData(ctx, entries, warehouseMapStream));
		})
	);

	return readableFromStream(ctx, dailySummary, {} as DailySummaryStore);
};

export interface CreateBookHistoryStores {
	(ctx: debug.DebugCtx, db?: InventoryDatabaseInterface, isbn?: string): BookHistoryStores;
}

export const createBookHistoryStores: CreateBookHistoryStores = (ctx, db, isbn = "") => {
	if (!db) {
		return {
			bookData: readable({} as BookEntry),
			transactions: readable([])
		};
	}

	const history = db.history().stream(ctx);
	const warehouseMapStream = db.stream().warehouseMap(ctx);

	const bookDataStream = db
		.books()
		.stream(ctx, [isbn])
		.pipe(map(([data]) => data || ({} as BookEntry)));
	const bookData = readableFromStream(ctx, bookDataStream, {} as BookEntry);

	const transactionsStream = combineLatest([history, warehouseMapStream]).pipe(
		// Get transactions for current isbn
		map(([history, warehouseMap]) => [history.by("isbn").get(isbn) || [], warehouseMap] as const),
		map(([transactions, warehouseMap]) =>
			wrapIter(transactions).map((txn) => ({ ...txn, warehouseName: warehouseMap.get(txn.warehouseId)?.displayName || "" }))
		),
		tap(debug.log(ctx, `transactions_for_isbn:${isbn}`)),
		map((pt) => pt.array())
	);
	const transactions = readableFromStream(ctx, transactionsStream, []);

	return { bookData, transactions };
};

export interface CreatePastNotesStores {
	(ctx: debug.DebugCtx, db?: InventoryDatabaseInterface, isbn?: string): Readable<PastNoteEntry[]>;
}

export const createPastNotesStore: CreatePastNotesStores = (ctx, db, date: string) => {
	if (!db) {
		return readable([] as any[]);
	}

	const history = db.history().stream(ctx);
	const warehouseMapStream = db.stream().warehouseMap(ctx);

	const transactions = history.pipe(
		map((pt) => pt.by("date").get(date) || []),
		switchMap((txns) => {
			const isbns = [...txns].map(({ isbn }) => isbn);
			return db
				.books()
				.stream(ctx, isbns)
				.pipe(map((data) => zip(data, txns)));
		}),
		map((data) => wrapIter(data).map(([book, txn]) => ({ ...book, ...txn })))
	);

	const notesStream = combineLatest([transactions, warehouseMapStream]).pipe(
		map(([txns, warehouseMap]) =>
			wrapIter(txns)
				.map((txn) => ({
					...txn,
					discount: warehouseMap.get(txn.warehouseId)?.discountPercentage || 0,
					warehouseName: warehouseMap.get(txn.warehouseId)?.displayName || txn.warehouseId
				}))
				._group((txn) => [txn.noteId, txn])
				.map(([, txns]) => txns)
				.map((txns) =>
					reduce(
						txns,
						(acc, txn) => {
							const id = txn.noteId;
							const date = txn.date;
							const displayName = txn.noteDisplayName;
							const noteType = txn.noteType;
							const warehouseName = noteType === "outbound" ? "Outbound" : txn.warehouseName;
							const books = acc.books + txn.quantity;
							const totalCoverPrice = acc.totalCoverPrice + txn.price * txn.quantity;
							const totalDiscountedPrice = acc.totalDiscountedPrice + Math.floor(txn.price * txn.quantity * (100 - txn.discount)) / 100;
							return { id, date, displayName, noteType, warehouseName, books, totalCoverPrice, totalDiscountedPrice };
						},
						{ books: 0, totalCoverPrice: 0, totalDiscountedPrice: 0 } as PastNoteEntry
					)
				)
				.array()
		)
	);

	return readableFromStream(ctx, notesStream, []);
};
