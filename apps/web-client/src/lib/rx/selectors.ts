import type { VolumeQuantity } from '$lib/types/db';
import type { BookStore } from '$lib/types/inventory';

// table_content as "selectors"
// I don't love this name, but idea is to isolate basic functions
// which could be dropped in to a Derived Svelte Store, a Rx Map function,
// Or just be called directly with reactive variables in a component

// TODO: Add JS Doc comments to each of these

export const getTableEntries = (entries: VolumeQuantity[], currentPage: number, books: BookStore) => {
	const start = currentPage * 10;
	const end = start + 10;

	return entries.slice(start, end).map(({ isbn, quantity }) => ({
		...books[isbn],
		isbn,
		quantity
	}));
};

export const getPaginationData = (entries: VolumeQuantity[], currentPage: number) => {
	const totalItems = entries.length;
	const numPages = Math.ceil(totalItems / 10);
	const firstItem = currentPage * 10 + 1;
	const lastItem = Math.min(firstItem + 9, totalItems);
	return {
		numPages,
		firstItem,
		lastItem,
		totalItems
	};
};
