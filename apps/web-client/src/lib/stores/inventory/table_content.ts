import { derived, type Readable } from 'svelte/store';
import { debug } from '@librocco/shared';

import type { NoteInterface, WarehouseInterface } from '@librocco/db';

import type { BookStore, DisplayRow, PaginationData } from '$lib/types/inventory';

import { readableFromStream } from '$lib/utils/streams';

interface CreateDisplayEntriesStore {
	(
		entity: NoteInterface | WarehouseInterface | undefined,
		currentPageStore: Readable<number>,
		bookStore: Readable<BookStore>,
		ctx: debug.DebugCtx
	): Readable<DisplayRow[]>;
}
/**
 * Creates a store that streams the entries to be displayed in the table, with respect to the content in the db and the current page (set by pagination element).
 * @param entity a note or warehouse interface
 * @param currentPageStore a store that containing the current page index
 * @param bookStore a store with book data - used to extend each entry from the entity store with the rest of the book data
 * @returns
 */
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (entity, currentPageStore, bookStore, ctx) => {
	const entriesStore = readableFromStream(entity?.stream(ctx).entries, [], ctx);
	// Create a derived store that streams the entries value from the content store
	const displayEntries = derived(
		[entriesStore, currentPageStore, bookStore],
		([$entriesStore, $currentPageStore, $bookStore]) => {
			debug.log(ctx, 'display_entries:derived:inputs')({ $entriesStore, $currentPageStore, $bookStore });
			const start = $currentPageStore * 10;
			const end = start + 10;

			const res = $entriesStore.slice(start, end).map((entry) => ({
				...$bookStore[entry.isbn],
				...entry
			}));
			debug.log(ctx, 'display_entries:derived:res')(res);
			return res;
		}
	);
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
