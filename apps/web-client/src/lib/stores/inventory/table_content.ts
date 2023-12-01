import { derived, get, readable, type Readable } from "svelte/store";
import { map, Observable, share, ReplaySubject, switchMap, tap, combineLatest, of, from, concatMap, filter, toArray } from "rxjs";

import { debug, wrapIter } from "@librocco/shared";
import type { BookEntry, DatabaseInterface, EntriesStreamResult, NoteInterface, VolumeStockClient, WarehouseInterface } from "@librocco/db";

import type { PaginationData, DisplayRow } from "$lib/types/inventory";

import { observableFromStore, readableFromStream } from "$lib/utils/streams";
import { debouncedStore } from "$lib/utils/stores";

interface CreateDisplayEntriesStore {
	(
		ctx: debug.DebugCtx,
		db: DatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface | WarehouseInterface | undefined,
		currentPageStore: Readable<number>,
		searchStore?: Readable<string>
	): {
		entries: Readable<DisplayRow[]>;
		paginationData: Readable<PaginationData>;
	};
}

type Config = {
	currentPage: number;
	searchString: string;
	itemsPerPage: number;
};

type Foo = Config & EntriesStreamResult;

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (ctx, db, entity, currentPageStore, searchStore = readable("")) => {
	const itemsPerPage = 10;

	const config = derived([currentPageStore, debouncedStore(searchStore, 200)], ([currentPage, searchString]) => ({
		itemsPerPage,
		currentPage,
		searchString
	}));

	const shareSubject = new ReplaySubject<[DisplayRow[], PaginationData]>(1);
	// Process the data received from the paginated stream, "ziping" the data with the book data
	// and returning pagination data.
	const pipeline =
		// Create a stream from the current page store
		observableFromStore(config)
			.pipe(
				tap(({ searchString }) => debug.logTimerStart(ctx, `search: ${searchString}`)),
				// Each time current page changes, update the paginated stream (from the db)
				switchMap((config) => {
					const currentPage = config.searchString ? 0 : config.currentPage;
					const itemsPerPage = config.searchString ? 0 : config.itemsPerPage;
					const stock = entity?.stream().entries(ctx, currentPage, itemsPerPage) || new Observable<EntriesStreamResult>();
					return stock.pipe(map((s) => ({ ...s, ...config })));
				})
			)
			.pipe(
				search(db),
				tap(({ searchString }) => debug.logTimerEnd(ctx, `search: ${searchString}`))
			)
			.pipe(
				switchMap(({ rows: r, ...rest }) => {
					// Map rows to just isbns
					const isbns = r.map((entry) => entry.isbn);

					debug.log(ctx, "display_entries_store:table_data:retrieving_books")({ isbns });

					// Return array of merged values of books and volume stock client
					const rows = db
						.books()
						.stream(ctx, isbns)
						.pipe(
							mapMergeBookData(ctx, r),
							// eslint-disable-next-line @typescript-eslint/no-unused-vars
							map((rows) => rows.map(({ warehouseDiscount, ...rest }) => rest))
						);

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

const applyDiscount = <T extends Pick<VolumeStockClient, "warehouseDiscount"> & Pick<BookEntry, "price">>({
	price,
	warehouseDiscount,
	...rest
}: T) => ({ ...rest, price: price ? Math.round(price * (100 - warehouseDiscount)) / 100 : undefined, warehouseDiscount } as T);

const mapMergeBookData = (ctx: debug.DebugCtx, stock: Iterable<VolumeStockClient>) => (o: Observable<Iterable<BookEntry | undefined>>) =>
	o.pipe(
		tap(debug.log(ctx, "display_entries_store:table_data:retrieved_books")),
		map(mergeBookData(stock)),
		tap(debug.log(ctx, "display_entries_store:table_data:merged_books")),
		map((transactions) => transactions.map(applyDiscount)),
		tap(debug.log(ctx, "display_entries_store:table_data:after_applied_discount"))
	);

const paginate = ({ rows, currentPage, itemsPerPage, searchString }: Foo): Foo => {
	const startIx = currentPage * itemsPerPage;
	const endIx = startIx + itemsPerPage;

	const total = rows.length;
	const totalPages = Math.ceil(total / itemsPerPage);

	return { rows: rows.slice(startIx, endIx), currentPage, itemsPerPage, total, totalPages, searchString };
};

const searchFilter = (db: DatabaseInterface, { searchString, rows, ...rest }: Foo): Observable<Foo> =>
	from(db.books().get(rows.map(({ isbn }) => isbn))).pipe(
		mapMergeBookData({}, rows),
		concatMap((rows) => from(rows)),
		filter(({ title }) => title?.includes(searchString)),
		toArray(),
		map((rows) => paginate({ rows, searchString, ...rest }))
	);

const search =
	(db: DatabaseInterface) =>
	(o: Observable<Foo>): Observable<Foo> =>
		o.pipe(switchMap(({ searchString, ...rest }) => (searchString ? searchFilter(db, { searchString, ...rest }) : o)));
