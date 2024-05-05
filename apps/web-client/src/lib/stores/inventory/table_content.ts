import { derived, get, readable, type Readable } from "svelte/store";
import { map, Observable, share, ReplaySubject, switchMap, tap, combineLatest, of } from "rxjs";

import { debug, wrapIter } from "@librocco/shared";
import {
	type BookEntry,
	type InventoryDatabaseInterface,
	type EntriesStreamResult,
	type NoteInterface,
	type VolumeStockClient,
	type WarehouseInterface,
	isCustomItemRow
} from "@librocco/db";

import type { PaginationData, DisplayRow } from "$lib/types/inventory";

import { observableFromStore, readableFromStream } from "$lib/utils/streams";

type SearchFilter = {
	searchString: string;
	// Using a quick experiment, the 'Set.has' seems to be the fastest for entry-existing-lookup
	// (compared to 'Array.includes' and 'Map.has')
	isbns: Set<string>;
};

interface CreateDisplayEntriesStore {
	(
		ctx: debug.DebugCtx,
		db: InventoryDatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface | WarehouseInterface | undefined,
		currentPageStore: Readable<number>,
		searchFilterStore?: Readable<SearchFilter>
	): {
		entries: Readable<DisplayRow[]>;
		paginationData: Readable<PaginationData>;
	};
}

type Config = {
	currentPage: number;
	searchFilter: SearchFilter;
	itemsPerPage: number;
};

type SearchSetup = Config & EntriesStreamResult<"book">;

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (
	ctx,
	db,
	entity,
	currentPageStore,
	searchFilterStore = readable<SearchFilter>({ searchString: "", isbns: new Set() })
) => {
	const itemsPerPage = 10;

	const config = derived([currentPageStore, searchFilterStore], ([currentPage, searchFilter]) => ({
		itemsPerPage,
		currentPage,
		searchFilter
	}));

	const shareSubject = new ReplaySubject<[DisplayRow[], PaginationData]>(1);
	// Process the data received from the paginated stream, "ziping" the data with the book data
	// and returning pagination data.
	const pipeline =
		// Create a stream from the current page store
		observableFromStore(config)
			.pipe(
				tap(({ searchFilter: { searchString } }) => debug.logTimerStart(ctx, `search: ${searchString}`)),
				// Each time current page changes, update the paginated stream (from the db)
				switchMap((config) => {
					const currentPage = config.searchFilter.searchString ? 0 : config.currentPage;
					const itemsPerPage = config.searchFilter.searchString ? 0 : config.itemsPerPage;
					const stock = entity?.stream().entries(ctx, currentPage, itemsPerPage) || new Observable<EntriesStreamResult>();
					return stock.pipe(map((s) => ({ ...s, ...config })));
				})
			)
			.pipe(
				search,
				tap(({ searchFilter: { searchString } }) => debug.logTimerEnd(ctx, `search: ${searchString}`))
			)
			.pipe(
				switchMap(({ rows: r, ...rest }) => {
					// We're returning undefined in lieu of isbn for custom item rows (this safe as undefined isbns will have undefined book data)
					const isbns = r.map((entry) => (isCustomItemRow(entry) ? undefined : entry.isbn));

					debug.log(ctx, "display_entries_store:table_data:retrieving_books")({ isbns });

					// Return array of merged values of books and volume stock client
					const rows = db.books().stream(ctx, isbns).pipe(mapMergeBookData(ctx, r));

					const pagination = of(rest).pipe(
						map(({ total: totalItems, totalPages: numPages }): PaginationData => {
							const firstItem = itemsPerPage * get(currentPageStore) + 1;
							const lastItem = Math.min(firstItem + itemsPerPage - 1, totalItems);

							return { totalItems, numPages, firstItem, lastItem };
						})
					);

					return combineLatest([rows, pagination]);
				})
			)
			.pipe(
				// Multicast the stream (for both the table and pagination stores)
				share({ connector: () => shareSubject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
			);

	const tableData = pipeline.pipe(map(([rows]) => rows));
	const paginationData = pipeline.pipe(map(([, pagination]) => pagination));

	return {
		entries: readableFromStream(ctx, tableData, []),
		paginationData: readableFromStream(ctx, paginationData, { totalItems: 0, numPages: 0, firstItem: 0, lastItem: 0 })
	};
};

const mergeBookData = (stock: Iterable<VolumeStockClient>) => (bookData: Iterable<BookEntry | undefined>) =>
	wrapIter(stock)
		.zip(bookData)
		.map(([s, b = {} as BookEntry]) => ({ ...s, ...b }))
		.array();

const applyDiscount = <T extends Pick<VolumeStockClient<"book">, "warehouseDiscount"> & Pick<BookEntry, "price">>({
	price,
	warehouseDiscount,
	...rest
}: T) => ({ ...rest, price: price ? Math.round(price * (100 - warehouseDiscount)) / 100 : undefined, warehouseDiscount } as T);

const mapMergeBookData = (ctx: debug.DebugCtx, stock: Iterable<VolumeStockClient>) => (o: Observable<Iterable<BookEntry | undefined>>) =>
	o.pipe(
		tap(debug.log(ctx, "display_entries_store:table_data:retrieved_books")),
		map(mergeBookData(stock)),
		tap(debug.log(ctx, "display_entries_store:table_data:merged_books")),
		map((transactions) => transactions.map((txn) => (isCustomItemRow(txn) ? txn : applyDiscount(txn)))),
		tap(debug.log(ctx, "display_entries_store:table_data:after_applied_discount"))
	);

const paginate = ({ rows, currentPage: cp, itemsPerPage, searchFilter }: SearchSetup): SearchSetup => {
	let currentPage = cp;
	let startIx = currentPage * itemsPerPage;
	let endIx = startIx + itemsPerPage;

	const total = rows.length;
	const totalPages = Math.ceil(total / itemsPerPage);

	if (startIx > total) {
		currentPage = 0;
		startIx = 0;
		endIx = startIx + itemsPerPage;
	}

	return { rows: rows.slice(startIx, endIx), currentPage, itemsPerPage, total, totalPages, searchFilter };
};

const search = (o: Observable<SearchSetup>): Observable<SearchSetup> =>
	o.pipe(
		switchMap(({ searchFilter: { searchString, isbns } }) =>
			searchString
				? o.pipe(
						map(({ rows, ...rest }) => ({ ...rest, rows: rows.filter(({ isbn }) => isbns.has(isbn)) })),
						map(paginate)
				  )
				: o
		)
	);
