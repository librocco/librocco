import { derived, type Readable } from 'svelte/store';
import { debug } from '@librocco/shared';

import type { DatabaseInterface, NoteInterface, WarehouseInterface } from '@librocco/db';

import type { PaginationData, DisplayRow } from '$lib/types/inventory';

import { readableFromStream } from '$lib/utils/streams';
import { from, map, Observable, switchMap } from 'rxjs';
import type { DebugCtx } from '@librocco/shared/dist/debugger';

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
	const fullTableRow = entity?.stream(ctx).entries.pipe(
		switchMap((valueFromEntryStream) => {
			// map entry to just isbns
			const isbns = valueFromEntryStream.map((entry) => entry.isbn);

			// return array of merged values of books and volume stock client
			return from(db.getBooks(isbns)).pipe(
				map((booksFromDb) => {
					const booksMap = new Map();
					booksFromDb.forEach((book) => book && booksMap.set(book.isbn, book));

					// for each value from entry stream (volume stock client)
					return valueFromEntryStream.map((individualEntry) => {
						// find the corresponding book in booksFromDb
						const bookData = booksMap.get(individualEntry.isbn);
						// account for books not found
						if (!bookData) return individualEntry;
						// return bookData + entry value
						const fullTableElement = { ...bookData, ...individualEntry };
						return fullTableElement;
					});
				})
			);
		})
	);

	return fullTableRow;
};

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param db current context database
 * @param entity a note or warehouse interface
 * @param currentPageStore a store that containing the current page index
 * @param ctx debug context
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (db, entity, currentPageStore, ctx) => {
	const fullTableRowStream = createDisplayRowStream(db, entity, ctx);
	const displayRowStore = readableFromStream(fullTableRowStream, [], ctx);

	// Create a derived store that streams the entries value from the content store
	const displayEntries = derived([displayRowStore, currentPageStore], ([$displayRowStore, $currentPageStore]) => {
		debug.log(ctx, 'display_entries:derived:inputs')({ $displayRowStore, $currentPageStore });
		const start = $currentPageStore * 10;
		const end = start + 10;

		const res = $displayRowStore.slice(start, end).map((entry) => ({
			...entry
		}));
		debug.log(ctx, 'display_entries:derived:res')(res);
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
	const entriesStore = readableFromStream(entity?.stream(ctx).entries, [], ctx);
	// Create a derived store that streams the pagination data derived from the entries and current page stores
	const paginationData = derived([entriesStore, currentPageStore], ([$entriesStore, $currentPageStore]) => {
		debug.log(ctx, 'pagination_data:derived:inputs')({ $entriesStore, $currentPageStore });
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
		debug.log(ctx, 'pagination_data:derived:res')(res);
		return res;
	});

	return paginationData;
};
