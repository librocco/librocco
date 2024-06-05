import { writable, type Readable, type Writable } from "svelte/store";
import { map, Observable, share, ReplaySubject, switchMap, tap, combineLatest } from "rxjs";

import { map as mapIter, debug, wrapIter, type VolumeStockKind } from "@librocco/shared";
import type {
	BookEntry,
	InventoryDatabaseInterface,
	EntriesStreamResult,
	NoteInterface,
	SearchIndex,
	VolumeStockClient,
	WarehouseInterface
} from "@librocco/db";

import type { DisplayRow } from "$lib/types/inventory";

import { observableFromStore, readableFromStream } from "$lib/utils/streams";

interface CreateDisplayEntriesStore<K extends VolumeStockKind = VolumeStockKind> {
	(
		ctx: debug.DebugCtx,
		db: InventoryDatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		searchIndex?: SearchIndex
	): {
		entries: Readable<DisplayRow<K>[]>;
		search: Writable<string>;
	};
}

export const createSearchStore = (ctx: debug.DebugCtx, searchIndex?: SearchIndex) => {
	const searchStore = writable("");

	const searchResStream = observableFromStore(searchStore).pipe(
		tap(debug.log(ctx, "display_entries_store:search:input")),
		// If the search index is not available, or the search store is empty, return an empty set (all results will be filtered out)
		map((searchString) => (searchIndex && searchString.length ? searchIndex.search(searchString) : []) as BookEntry[]),
		tap(debug.log(ctx, "display_entries_store:search:search_result"))
	);
	const searchResStore = readableFromStream(ctx, searchResStream, []);

	return { searchResStream, searchStore, searchResStore };
};

export const createFilteredEntriesStore: CreateDisplayEntriesStore<"book"> = (ctx, db, searchIndex) => {
	const { searchStore, searchResStream } = createSearchStore(ctx, searchIndex);
	const filteredIsbnsStream = searchResStream.pipe(map((res) => new Set(mapIter(res, ({ isbn }) => isbn))));

	// We're searching all of the entries -> default pseudo warehouse
	const entriesStream = db?.warehouse().stream().entries(ctx) || new Observable<EntriesStreamResult<"book">>();

	const shareSubject = new ReplaySubject<DisplayRow<"book">[]>(1);
	const tableData = combineLatest([filteredIsbnsStream, entriesStream]).pipe(
		map(([matchedIsbns, { rows }]) => rows.filter(({ isbn }) => matchedIsbns.has(isbn))),
		switchMap((r) => {
			// Map rows to just isbns
			const isbns = r.map((entry) => entry.isbn);

			debug.log(ctx, "display_entries_store:table_data:retrieving_books")({ isbns });

			// Return array of merged values of books and volume stock client
			const rows = db.books().stream(ctx, isbns).pipe(mapMergeBookData(ctx, r));

			return rows;
		}),
		// Multicast the stream (for both the table and pagination stores)
		share({ connector: () => shareSubject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
	);

	return {
		entries: readableFromStream(ctx, tableData, []),
		search: searchStore
	};
};

export const mergeBookData = (stock: Iterable<VolumeStockClient>) => (bookData: Iterable<BookEntry | undefined>) =>
	wrapIter(stock)
		.zip(bookData)
		.map(([s, b = {} as BookEntry]) => ({ ...s, ...b }))
		.array();

export const mapMergeBookData =
	(ctx: debug.DebugCtx, stock: Iterable<VolumeStockClient>) => (o: Observable<Iterable<BookEntry | undefined>>) =>
		o.pipe(
			tap(debug.log(ctx, "display_entries_store:table_data:retrieved_books")),
			map(mergeBookData(stock)),
			tap(debug.log(ctx, "display_entries_store:table_data:merged_books"))
		);
