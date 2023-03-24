import { derived, type Readable } from "svelte/store";
import { debug } from "@librocco/shared";

import type { BookEntry, DatabaseInterface, NoteInterface, WarehouseInterface } from "@librocco/db";

import type { PaginationData, DisplayRow } from "$lib/types/inventory";

import { readableFromStream } from "$lib/utils/streams";
import { map, Observable, switchMap } from "rxjs";
import type { DebugCtx } from "@librocco/shared/dist/debugger";

interface CreateDisplayEntriesStore {
	(
		db: DatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface | WarehouseInterface | undefined,
		currentPageStore: Readable<number>,
		ctx: debug.DebugCtx
	): Readable<DisplayRow[]>;
}

interface CreateDisplayRowStream {
	(
		db: DatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface<object> | WarehouseInterface<NoteInterface<object>, object>,
		ctx: DebugCtx
	): Observable<DisplayRow[]>;
}

const createDisplayRowStream: CreateDisplayRowStream = (db, entity, ctx) => {
	const fullTableRow = entity
		?.stream()
		.entries(ctx)
		.pipe(
			switchMap((valueFromEntryStream) => {
				// map entry to just isbns
				const isbns = valueFromEntryStream.map((entry) => entry.isbn);

				// return array of merged values of books and volume stock client
				return db
					.books()
					.stream(isbns, ctx)
					.pipe(map((booksFromDb) => booksFromDb.map((b = {} as BookEntry, i) => ({ ...b, ...valueFromEntryStream[i] }))));
			})
		);

	return fullTableRow;
};

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @param ctx debug context
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (db, entity, currentPageStore, ctx) => {
	const fullTableRowStream = createDisplayRowStream(db, entity, ctx);
	const entriesStore = readableFromStream(fullTableRowStream, [], ctx);

	// Create a derived store that streams the entries value from the content store
	const displayEntries = derived([entriesStore, currentPageStore], ([$entriesStore, $currentPageStore]) => {
		debug.log(ctx, "display_entries:derived:input")({ $entriesStore, $currentPageStore });
		const start = $currentPageStore * 10;
		const end = start + 10;

		const res = $entriesStore.slice(start, end);
		debug.log(ctx, "display_entries:derived:res")(res);

		return res;
	});
	return displayEntries;
};

/**
 * Creates a store that streams the pagination data derived from the entries and current page stores.
 * @param entity a note or warehouse interface
 * @param currentPageStore the store containing the current page index (set by pagination element)
 * @returns
 */
export const createPaginationDataStore = (
	entity: NoteInterface | WarehouseInterface | undefined,
	currentPageStore: Readable<number>,
	ctx: debug.DebugCtx
): Readable<PaginationData> => {
	const entriesStore = readableFromStream(entity?.stream().entries(ctx), [], ctx);
	// Create a derived store that streams the pagination data derived from the entries and current page stores
	const paginationData = derived([entriesStore, currentPageStore], ([$entriesStore, $currentPageStore]) => {
		debug.log(ctx, "pagination_data:derived:inputs")({ $entriesStore, $currentPageStore });
		const totalItems = $entriesStore.length;
		const numPages = Math.ceil(totalItems / 10);
		// If there are no items, (for one this won't be shown) we're returning 0 as first item
		const firstItem = totalItems ? $currentPageStore * 10 + 1 : 0;
		const lastItem = Math.min(firstItem + 9, totalItems);

		const res = {
			numPages,
			firstItem,
			lastItem,
			totalItems
		};
		debug.log(ctx, "pagination_data:derived:res")(res);
		return res;
	});

	return paginationData;
};
