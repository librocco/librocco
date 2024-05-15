import type { Readable } from "svelte/store";
import { map, Observable, share, ReplaySubject, switchMap, tap } from "rxjs";

import { debug, wrapIter, type VolumeStockKind } from "@librocco/shared";
import type {
	BookEntry,
	InventoryDatabaseInterface,
	EntriesStreamResult,
	NoteInterface,
	VolumeStockClient,
	WarehouseInterface,
	EntriesStreamCsvResult,
	VolumeStockCsv
} from "@librocco/db";

import type { DisplayRow } from "$lib/types/inventory";

import { readableFromStream } from "$lib/utils/streams";

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createDisplayEntriesStore = <K extends VolumeStockKind = VolumeStockKind>(
	ctx: debug.DebugCtx,
	db: InventoryDatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
	entity: NoteInterface | WarehouseInterface | undefined
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
			const rows = db.books().stream(ctx, isbns).pipe(mapMergeBookData(ctx, r));
			return rows as Observable<DisplayRow<K>[]>;
		}),
		// Multicast the stream (for both the table and pagination stores)
		share({ connector: () => shareSubject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
	);

	return readableFromStream(ctx, tableData, []);
};
/**
 * Creates a store that streams the entries to be used for generating a csv file.
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createCsvEntriesStore = <K extends "book">(
	ctx: debug.DebugCtx,
	db: InventoryDatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
	entity: WarehouseInterface | undefined
): Readable<
	({
		warehouseDiscount: number;
		warehouseName: string;
	} & BookEntry)[]
> => {
	const shareSubject = new ReplaySubject<DisplayRow<K>[]>(1);

	const entriesStream = (entity?.stream().entriesCsv(ctx) || new Observable()) as Observable<EntriesStreamCsvResult<K>>;
	const tableData = entriesStream.pipe(
		map(({ rows }) => rows),

		switchMap((r) => {
			const isbns = r.map((entry) => entry.isbn);

			debug.log(ctx, "csv_entries_store:table_data:retrieving_books")({ isbns });

			const rows = db.books().stream(ctx, isbns).pipe(mapMergeBookDataCsv(ctx, r));

			return rows as Observable<DisplayRow<K>[]>;
		}),
		share({ connector: () => shareSubject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
	);

	return readableFromStream(ctx, tableData, []);
};

const mergeBookData = (stock: Iterable<VolumeStockClient>) => (bookData: Iterable<BookEntry | undefined>) =>
	wrapIter(stock)
		.zip(bookData)
		.map(([s, b = {} as BookEntry]) => ({ ...s, ...b }))
		.array();

const mapMergeBookData = (ctx: debug.DebugCtx, stock: Iterable<VolumeStockClient>) => (o: Observable<Iterable<BookEntry | undefined>>) =>
	o.pipe(
		tap(debug.log(ctx, "display_entries_store:table_data:retrieved_books")),
		map(mergeBookData(stock)),
		tap(debug.log(ctx, "display_entries_store:table_data:merged_books"))
	);

const mergeBookDataNoNull = (stock: Iterable<VolumeStockCsv>) => (bookData: Iterable<BookEntry | undefined>) =>
	wrapIter(stock)
		.zip(bookData)
		.map(([s, b = {} as BookEntry]) => ({
			...s,
			...b,
			year: b.year ?? "",
			publisher: b.publisher ?? "",
			editedBy: b.editedBy ?? "",
			authors: b.authors ?? ""
		}))
		.array();

const mapMergeBookDataCsv = (ctx: debug.DebugCtx, stock: Iterable<VolumeStockCsv>) => (o: Observable<Iterable<BookEntry | undefined>>) =>
	o.pipe(
		tap(debug.log(ctx, "display_entries_store:table_data:retrieved_books")),
		map(mergeBookDataNoNull(stock)),
		tap(debug.log(ctx, "display_entries_store:table_data:merged_books"))
	);
