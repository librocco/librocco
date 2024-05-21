import type { Readable } from "svelte/store";
import { map, Observable, share, ReplaySubject, switchMap, tap } from "rxjs";

import { debug, wrapIter, type VolumeStockKind } from "@librocco/shared";
import type {
	BookEntry,
	InventoryDatabaseInterface,
	EntriesStreamResult,
	NoteInterface,
	VolumeStockClient,
	WarehouseInterface
} from "@librocco/db";

import type { DisplayRow, DisplayStoreKind } from "$lib/types/inventory";

import { readableFromStream } from "$lib/utils/streams";

type mapMergeBookDataFunction<A extends DisplayStoreKind> = (
	ctx: debug.DebugCtx,
	stock: Iterable<VolumeStockClient>
) => (
	o: Observable<Iterable<BookEntry | undefined>>
) => A extends "csv" ? Observable<Omit<DisplayRow, "warehouseId">[]> : Observable<DisplayRow[]>;

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createDisplayEntriesStore = <K extends VolumeStockKind = VolumeStockKind, A extends DisplayStoreKind = DisplayStoreKind>(
	ctx: debug.DebugCtx,
	db: InventoryDatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
	entity: NoteInterface | WarehouseInterface | undefined,
	mapFunction: mapMergeBookDataFunction<A>
): Readable<DisplayRow<K>[]> => {
	const shareSubject = new ReplaySubject<DisplayRow<K>[]>(1);

	const entriesStream = (entity?.stream().entries(ctx) || new Observable()) as Observable<EntriesStreamResult<K>>;
	const tableData = entriesStream.pipe(
		map(({ rows }) => rows),
		// Process the data received from the paginated stream, "ziping" the data with the book data
		// and returning pagination data.
		switchMap((r) => {
			// Map rows to just isbns
			const isbns = r.map((entry) => (entry.__kind === "custom" ? undefined : entry.isbn));

			debug.log(ctx, "display_entries_store:table_data:retrieving_books")({ isbns });

			// Return array of merged values of books and volume stock client
			const rows = db.books().stream(ctx, isbns).pipe(mapFunction(ctx, r));
			return rows as Observable<DisplayRow<K>[]>;
		}),
		// Multicast the stream (for both the table and pagination stores)
		share({ connector: () => shareSubject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
	);

	return readableFromStream(ctx, tableData, []);
};

// create two curried functions one with csv and one with entries mapping function
// when csv mappig is called

const mergeBookData = (stock: Iterable<VolumeStockClient>) => (bookData: Iterable<BookEntry | undefined>) =>
	wrapIter(stock)
		.zip(bookData)
		.map(([s, b = {} as BookEntry]) => ({ ...s, ...b }))
		.array();

export const mapMergeBookData: mapMergeBookDataFunction<"entries"> = (ctx, stock) => (o) =>
	o.pipe(
		tap(debug.log(ctx, "display_entries_store:table_data:retrieved_books")),
		map(mergeBookData(stock)),
		tap(debug.log(ctx, "display_entries_store:table_data:merged_books"))
	);

const mergeBookDataCsv = (stock: Iterable<VolumeStockClient>) => (bookData: Iterable<BookEntry | undefined>) =>
	wrapIter(stock as Iterable<VolumeStockClient<"book">>)
		.zip(bookData)
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		.map(([{ __kind, warehouseId, ...rest }, b = {} as BookEntry]) => ({
			...rest,
			...b,
			year: b.year ?? "",
			publisher: b.publisher ?? "",
			editedBy: b.editedBy ?? "",
			authors: b.authors ?? "",
			discountedPrice: ((b.price * (100 - rest.warehouseDiscount || 0)) / 100).toFixed(2)
		}))
		.array();

export const mapMergeBookDataCsv: mapMergeBookDataFunction<"csv"> = (ctx, stock) => (o) =>
	o.pipe(
		tap(debug.log(ctx, "display_entries_store:table_data:retrieved_books")),
		map(mergeBookDataCsv(stock)),
		tap(debug.log(ctx, "display_entries_store:table_data:merged_books"))
	);
