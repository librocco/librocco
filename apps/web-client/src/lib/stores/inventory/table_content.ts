import { get, type Readable } from "svelte/store";
import { map, Observable, share, ReplaySubject, switchMap, tap } from "rxjs";

import { unwrap, wrap, logger, type ValueWithMeta } from "@librocco/rxjs-logger";
import type { debug } from "@librocco/shared";
import type { BookEntry, DatabaseInterface, EntriesStreamResult, NoteInterface, WarehouseInterface } from "@librocco/db";

import type { PaginationData, DisplayRow } from "$lib/types/inventory";

import { observableFromStore, readableFromStream } from "$lib/utils/streams";

interface CreateDisplayEntriesStore {
	(
		ctx: debug.DebugCtx,
		db: DatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface | WarehouseInterface | undefined,
		currentPageStore: Readable<number>
	): {
		entries: Readable<DisplayRow[]>;
		paginationData: Readable<PaginationData>;
	};
}

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (ctx, db, entity, currentPageStore) => {
	const itemsPerPage = 10;

	const shareSubject = new ReplaySubject<ValueWithMeta<EntriesStreamResult>>(1);
	// Create a stream from the current page store
	const entriesStream = observableFromStore(currentPageStore).pipe(
		// Each time current page changes, update the paginated stream (from the db)
		switchMap((page) => entity?.stream().entries(ctx, page, itemsPerPage) || new Observable<ValueWithMeta<EntriesStreamResult>>()),
		// Multicast the stream (for both the table and pagination stores)
		share({ connector: () => shareSubject })
	);

	// Process the data received from the paginated stream, "ziping" the data with the book data
	// and returning pagination data.
	const tableDataPipeline = `${ctx.name}::table_data`;
	const tableData = entriesStream.pipe(
		logger.fork(tableDataPipeline),
		switchMap(({ value, ...meta }) => {
			const { rows } = value;

			// Map rows to just isbns
			const isbns = rows.map((entry) => entry.isbn);

			// Return array of merged values of books and volume stock client
			return db
				.books()
				.stream(ctx, isbns)
				.pipe(
					wrap(() => meta),
					logger.logOnce(
						"map::entries_to_table_rows",
						map((booksFromDb) => booksFromDb.map((b = {} as BookEntry, i) => ({ ...b, ...rows[i] })))
					)
				);
		}),
		unwrap()
	);

	const paginationDataPipeline = `${ctx.name}::pagination_data`;
	const paginationData: Observable<PaginationData> = entriesStream.pipe(
		logger.fork(paginationDataPipeline),
		logger.log(
			"map::stats_to_pagination_data",
			map(({ total: totalItems, totalPages: numPages }): PaginationData => {
				const firstItem = itemsPerPage * get(currentPageStore) + 1;
				const lastItem = Math.min(firstItem + itemsPerPage - 1, totalItems);

				return { totalItems, numPages, firstItem, lastItem };
			})
		),
		unwrap()
	);

	return {
		entries: readableFromStream(ctx, tableData, []),
		paginationData: readableFromStream(ctx, paginationData, { totalItems: 0, numPages: 0, firstItem: 0, lastItem: 0 })
	};
};
