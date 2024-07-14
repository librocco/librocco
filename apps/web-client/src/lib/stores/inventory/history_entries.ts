import { switchMap, combineLatest, map, tap, from } from "rxjs";
import { readable, type Readable } from "svelte/store";

import { debug, wrapIter, zip, reduce, composeCompare, asc } from "@librocco/shared";
import type { BookEntry, InventoryDatabaseInterface, PastTransaction } from "@librocco/db";

import type { BookHistoryStores, DailySummaryStore, DisplayRow, PastNoteEntry } from "$lib/types/inventory";
import { readableFromStream } from "$lib/utils/streams";
import { mapMergeBookWarehouseData } from "$lib/utils/misc";
import { getLocalTimeZone, type DateValue } from "@internationalized/date";
import type { PastTransactionsMap } from "@librocco/db";

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
		.pipe(map((pt) => (pt ? pt.by("date") : {})));

	const warehouseMapStream = db.stream().warehouseMap(ctx);

	const dailySummary = pastTransactionsStream.pipe(
		switchMap((txnMap: PastTransactionsMap) => {
			const entries = [...(txnMap.get(date) || [])].sort(compareTxns);
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
			transactions: readable([]),
			stock: readable([])
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
		map((pt) => pt.array()),
		map((txns) => txns.sort(compareTxns))
	);
	const transactions = readableFromStream(ctx, transactionsStream, []);

	const stockStream = db
		?.stream()
		.stock()
		.pipe(
			map((s) => [...s.isbn(isbn)]),
			map((s) => s.filter(([, { quantity }]) => Boolean(quantity))),
			map((s) => s.map(([[, warehouseId], { quantity }]) => ({ warehouseId, quantity })))
		);

	const combinedStockStream = combineLatest([warehouseMapStream, stockStream]).pipe(
		map(([w, s]) =>
			s.map(({ warehouseId, quantity }) => ({
				warehouseId,
				quantity,
				warehouseName: w.get(warehouseId)?.displayName || warehouseId.split("/").pop()
			}))
		)
	);

	const stock = readableFromStream({}, combinedStockStream, []);

	return { bookData, transactions, stock };
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
							const totalCoverPrice = acc.totalCoverPrice + (txn.price || 0) * txn.quantity;
							const totalDiscountedPrice =
								acc.totalDiscountedPrice + Math.floor((txn.price || 0) * txn.quantity * (100 - txn.discount)) / 100;
							return { id, date, displayName, noteType, warehouseName, books, totalCoverPrice, totalDiscountedPrice };
						},
						{ books: 0, totalCoverPrice: 0, totalDiscountedPrice: 0 } as PastNoteEntry
					)
				)
				.array()
				.sort(composeCompare(asc(({ date }) => date)))
		)
	);

	return readableFromStream(ctx, notesStream, []);
};

interface WarehouseHistoryStores {
	displayName: Readable<string>;
	transactions: Readable<(PastTransaction & DisplayRow<"book">)[]>;
}

export interface CreateWarehouseHistoryStore {
	(
		ctx: debug.DebugCtx,
		db: InventoryDatabaseInterface | undefined,
		warehouseId: string,
		from: DateValue,
		to: DateValue,
		filter: string
	): WarehouseHistoryStores;
}

export const createWarehouseHistoryStores: CreateWarehouseHistoryStore = (ctx, db, warehouseId, _from, _to, filter) => {
	const displayName = readableFromStream(ctx, db?.warehouse(warehouseId).stream().displayName(ctx), "");

	if (!db) {
		return { displayName, transactions: readable([]) };
	}

	// Create range of days we're querying for
	const _fromMillis = Number(_from.toDate(getLocalTimeZone()));
	const _toMillis = Number(_to.toDate(getLocalTimeZone()));
	const dayDiff = Math.ceil((_toMillis - _fromMillis) / (1000 * 60 * 60 * 24));
	if (dayDiff < 0) {
		return { displayName, transactions: readable([]) };
	}

	const dateRange = Array(dayDiff + 1)
		.fill(null)
		.map((_, i) => _from.add({ days: i }).toString().slice(0, 10));

	const history = db.history().stream(ctx);
	const warehouseDataStream = from(db.warehouse(warehouseId).get());

	const transactionsStream = combineLatest([history, warehouseDataStream]).pipe(
		// Get transactions for current isbn
		map(([history, wh]) => [history.by("date"), wh] as const),
		map(([history, wh]) =>
			wrapIter(dateRange)
				.flatMap((date) => history.get(date) || [])
				// We're checking against warehouse document's id as that provides us with the full doc path
				.filter((txn) => txn.warehouseId === wh._id)
				.filter((txn) => txn.noteType.includes(filter))
		),
		switchMap((txns) => {
			const isbns = txns.map(({ isbn }) => isbn).array();
			return db
				.books()
				.stream(ctx, isbns)
				.pipe(map((data) => txns.zip(data).map(([txn, book]) => ({ ...txn, ...book }))));
		}),
		map((pt) => pt.array().sort(compareTxns))
	);
	const transactions = readableFromStream(ctx, transactionsStream, []);

	return { displayName, transactions };
};

const compareTxns = composeCompare<Pick<PastTransaction, "isbn" | "noteId" | "warehouseId" | "date">>(
	asc(({ date }) => date),
	asc(({ noteId }) => noteId.split("/").pop()),
	asc(({ isbn }) => isbn),
	asc(({ warehouseId }) => warehouseId)
);
