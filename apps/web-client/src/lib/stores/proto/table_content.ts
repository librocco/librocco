import type { Readable } from "svelte/store";
import { map, Observable, share, ReplaySubject, switchMap, tap } from "rxjs";

import { debug, wrapIter } from "@librocco/shared";
import type { BookEntry, DatabaseInterface, EntriesStreamResult, NoteInterface, VolumeStockClient, WarehouseInterface } from "@librocco/db";

import type { DisplayRow } from "$lib/types/inventory";

import { readableFromStream } from "$lib/utils/streams";

interface CreateDisplayEntriesStore {
	(
		ctx: debug.DebugCtx,
		db: DatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface | WarehouseInterface | undefined
	): Readable<DisplayRow[]>;
}

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (ctx, db, entity) => {
	const shareSubject = new ReplaySubject<DisplayRow[]>(1);

	const entriesStream = entity?.stream().entries(ctx) || new Observable<EntriesStreamResult>();
	const tableData = entriesStream.pipe(
		map(({ rows }) => rows),
		// Process the data received from the paginated stream, "ziping" the data with the book data
		// and returning pagination data.
		switchMap((r) => {
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

			return rows;
		}),
		// Multicast the stream (for both the table and pagination stores)
		share({ connector: () => shareSubject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
	);

	return readableFromStream(ctx, tableData, []);
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
