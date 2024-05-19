import { switchMap, combineLatest, map, tap } from "rxjs";
import { readable, type Readable } from "svelte/store";
import type { DateValue } from "@internationalized/date";

import { debug, wrapIter } from "@librocco/shared";
import type { BookEntry, InventoryDatabaseInterface } from "@librocco/db";

import type { BookHistoryStores, DailySummaryStore } from "$lib/types/inventory";
import { observableFromStore, readableFromStream } from "$lib/utils/streams";
import { mapMergeBookWarehouseData } from "$lib/utils/misc";

interface CreateDailySummaryStore {
	(ctx: debug.DebugCtx, db: InventoryDatabaseInterface | undefined, dateValue: Readable<DateValue>): Readable<DailySummaryStore>;
}

export const createDailySummaryStore: CreateDailySummaryStore = (ctx, db, dateValue) => {
	if (!db) {
		return readable({} as DailySummaryStore);
	}

	const pastTransactionsStream = db
		.history()
		.stream(ctx)
		.pipe(map((pt) => pt.by("date")));
	const warehouseMapStream = db.stream().warehouseMap(ctx);

	const dailySummary = combineLatest([pastTransactionsStream, observableFromStore(dateValue)]).pipe(
		switchMap(([txnMap, date]) => {
			const entries = [...(txnMap.get(date.toString().slice(0, 10)) || [])];

			const isbns = entries.map(({ isbn }) => isbn);

			return db.books().stream(ctx, isbns).pipe(mapMergeBookWarehouseData(ctx, entries, warehouseMapStream));
		})
	);

	return readableFromStream(ctx, dailySummary, {} as DailySummaryStore);
};

export interface createBookHistoryStores {
	(ctx: debug.DebugCtx, db?: InventoryDatabaseInterface, isbn?: string): BookHistoryStores;
}

export const createBookHistoryStores: createBookHistoryStores = (ctx, db, isbn = "") => {
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
