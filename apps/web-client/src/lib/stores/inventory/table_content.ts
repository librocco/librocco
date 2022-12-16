import { derived, type Readable } from 'svelte/store';

import type { BookStore, DisplayRow, NoteStore, PaginationData, WarehouseStore } from '$lib/types/inventory';

interface CreateEntriesStore {
	(contentStore: Readable<NoteStore | WarehouseStore>, bookStore: Readable<BookStore>, noteId?: string): Readable<
		DisplayRow[]
	>;
}
export const createEntriesStore: CreateEntriesStore = (contentStore, bookStore, noteId) => {
	// Create a derived store that streams the entries value from the content store
	const entries = derived([contentStore, bookStore], ([$contentStore, $bookStore]) => {
		if (!noteId || !$contentStore[noteId as string]) return [];
		return $contentStore[noteId].entries.map(({ isbn, quantity }) => ({ ...$bookStore[isbn], quantity, isbn }));
	});
	return entries;
};

interface CreateDisplayEntriesStore {
	(entriesStore: Readable<DisplayRow[]>, currentPageStore: Readable<number>): Readable<DisplayRow[]>;
}
export const createDisplayEntriesStore: CreateDisplayEntriesStore = (entriesStore, currentPageStore) => {
	// Create a derived store that streams the entries value from the content store
	const displayEntries = derived([entriesStore, currentPageStore], ([$entriesStore, $currentPageStore]) => {
		const start = $currentPageStore * 10;
		const end = start + 10;
		return $entriesStore.slice(start, end);
	});
	return displayEntries;
};
export const createPaginationDataStore = (
	entriesStore: Readable<DisplayRow[]>,
	currentPageStore: Readable<number>
): Readable<PaginationData> => {
	// Create a derived store that streams the pagination data derived from the entries and current page stores
	const paginationData = derived([entriesStore, currentPageStore], ([$entriesStore, $currentPageStore]) => {
		const totalItems = $entriesStore.length;
		const numPages = Math.ceil(totalItems / 10);
		const firstItem = $currentPageStore * 10 + 1;
		const lastItem = Math.min(firstItem + 9, totalItems);
		return {
			numPages,
			firstItem,
			lastItem,
			totalItems
		};
	});

	return paginationData;
};
