import { derived, type Readable } from 'svelte/store';
import { debug } from '@librocco/shared';

import type { NoteInterface, WarehouseInterface } from '@librocco/db';

import type { PaginationData, FullTableRow } from '$lib/types/inventory';

import { readableFromStream } from '$lib/utils/streams';
import { from, map, Observable, switchMap, tap } from 'rxjs';
import { db } from '$lib/db';
import type { DebugCtx } from '@librocco/shared/dist/debugger';

interface CreateDisplayEntriesStore {
	(
		entity: NoteInterface | WarehouseInterface | undefined,
		currentPageStore: Readable<number>,
		ctx: debug.DebugCtx
	): Readable<FullTableRow[]>;
}

interface createDisplayRowStream {
	(entity: NoteInterface<object> | WarehouseInterface<NoteInterface<object>, object>, ctx: DebugCtx): Observable<
		FullTableRow[]
	>;
}

const createDisplayRowStream: createDisplayRowStream = (entity, ctx) => {
	const fullTableRow = entity?.stream(ctx).entries.pipe(
		switchMap((valueFromEntryStream) => {
			const isbns = valueFromEntryStream.map((entry) => entry.isbn);
			// map entry to just isbns
			return from(db.getBooks(isbns)).pipe(
				tap((val) => console.log({ val })),

				map((booksFromDb) => {
					// for each value from entry stream (volume stock client)
					return valueFromEntryStream.map((individualEntry) => {
						// find the corresponding book in booksFromDb
						// instead of find => look in the same index then look at first element (maybe book is not in yet???)
						const bookData = booksFromDb.find((book) => book.isbn === individualEntry.isbn);
						// account for books not found
						if (!bookData) return;
						// return bookData + entry value
						const fullTableElement = { ...bookData, ...individualEntry };
						return fullTableElement;
					});
					// return array of merged values of books and volume stock client
				}),
				tap((mergedValue) => console.log({ mergedValue }))
			);
		}),
		tap((mergedValuesArray) => console.log({ mergedValuesArray }))
	);

	return fullTableRow;
};

/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param entity a note or warehouse interface
 * @param currentPageStore a store that containing the current page index
 * @param bookStore a store with book data - used to extend each entry from the entity store with the rest of the book data
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (entity, currentPageStore, ctx) => {
	const fullTableRowStream = createDisplayRowStream(entity, ctx);
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
