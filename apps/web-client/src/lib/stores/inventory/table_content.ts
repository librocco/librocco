import { derived, type Readable } from "svelte/store";
import { debug } from "@librocco/shared";

import type { BookEntry, DatabaseInterface, NoteInterface, WarehouseInterface } from "@librocco/db";

import type { PaginationData, DisplayRow } from "$lib/types/inventory";

import { readableFromStream } from "$lib/utils/streams";
import { map, Observable, switchMap } from "rxjs";
import type { DebugCtx } from "@librocco/shared/dist/debugger";

interface CreateDisplayEntriesStore {
	(
		ctx: debug.DebugCtx,
		db: DatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface | WarehouseInterface | undefined,
		currentPageStore: Readable<number>
	): Readable<DisplayRow[]>;
}

interface CreateDisplayRowStream {
	(
		ctx: DebugCtx,
		db: DatabaseInterface<WarehouseInterface<NoteInterface<object>, object>, NoteInterface<object>>,
		entity: NoteInterface<object> | WarehouseInterface<NoteInterface<object>, object>
	): Observable<DisplayRow[]>;
}

const createDisplayRowStream: CreateDisplayRowStream = (ctx, db, entity) => {
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
					.stream(ctx, isbns)
					.pipe(map((booksFromDb) => booksFromDb.map((b = {} as BookEntry, i) => ({ ...b, ...valueFromEntryStream[i] }))));
			})
		);

	return fullTableRow;
};

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param ctx debug context
 * @param db database interface
 * @param entity a note or warehouse interface
 * @param currentPageStore a store containing the current page index
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (ctx, db, entity, currentPageStore) => {
	const fullTableRowStream = createDisplayRowStream(ctx, db, entity);
	const entriesStore = readableFromStream(ctx, fullTableRowStream, []);

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
 * @param ctx debug context
 * @param entity a note or warehouse interface
 * @param currentPageStore the store containing the current page index (set by pagination element)
 * @returns
 */
export const createPaginationDataStore = (
	ctx: debug.DebugCtx,
	entity: NoteInterface | WarehouseInterface | undefined,
	currentPageStore: Readable<number>
): Readable<PaginationData> => {
	const entriesStore = readableFromStream(ctx, entity?.stream().entries(ctx), []);
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
