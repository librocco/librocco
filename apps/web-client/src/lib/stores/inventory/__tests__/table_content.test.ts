import { describe, test, expect } from 'vitest';

import type { PaginationData } from '$lib/types/inventory';

import { createDisplayEntriesStore, createPaginationDataStore } from '../table_content';

import type { VolumeQuantity } from '$lib/types/db';
import { readable } from 'svelte/store';

describe('tableContentStore', () => {
	test("should not explode if no 'entity' is provided", async () => {
		const de$ = createDisplayEntriesStore(undefined, readable(0), readable({}));
		let displayEntries: VolumeQuantity[] | undefined;
		de$.subscribe((de) => (displayEntries = de));
		expect(displayEntries).toEqual([]);

		const pd$ = createPaginationDataStore(undefined, readable(0));
		let paginationData: PaginationData | undefined;
		pd$.subscribe((pd) => (paginationData = pd));
		expect(paginationData).toEqual({
			numPages: 0,
			firstItem: 0,
			lastItem: 0,
			totalItems: 0
		} as PaginationData);
	});
});
