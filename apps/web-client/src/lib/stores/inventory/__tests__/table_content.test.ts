import { describe, test, expect } from 'vitest';

import type { PaginationData, FullTableRow } from '$lib/types/inventory';

import { createDisplayEntriesStore, createPaginationDataStore } from '../table_content';

import type { VolumeQuantity } from '$lib/types/db';
import { readable } from 'svelte/store';
import { newTestDB } from '$lib/__testUtils__/db';

describe('tableContentStore', () => {
	test("should not explode if no 'entity' is provided", async () => {
		const de$ = createDisplayEntriesStore(undefined, readable(0), {});
		let displayEntries: VolumeQuantity[] | undefined;
		de$.subscribe((de) => (displayEntries = de));
		expect(displayEntries).toEqual([]);

		const pd$ = createPaginationDataStore(undefined, readable(0), {});
		let paginationData: PaginationData | undefined;
		pd$.subscribe((pd) => (paginationData = pd));
		expect(paginationData).toEqual({
			numPages: 0,
			firstItem: 0,
			lastItem: 0,
			totalItems: 0
		} as PaginationData);
	});
	test('should create display store from db and entries streams', async () => {
		const db = await newTestDB();
		await db.upsertBook({
			isbn: '0007149522',
			title: 'The Age of Wonder',
			authors: ['Richard Holmes'],
			publisher: 'HarperCollins UK',
			year: '2008',
			price: 69.99
		});
		const note = await db.warehouse().note('note-1').create();
		const books = await db.getBooks(['0007149522']);
		await note.update({
			entries: [
				{
					isbn: '0195399706',
					warehouse: 'jazz',
					quantity: 12
				},
				{
					isbn: '019976915X',
					warehouse: 'jazz',
					quantity: 10
				},
				{
					isbn: '0195071409',
					warehouse: 'jazz',
					quantity: 5
				}
			]
		});

		const de$ = createDisplayEntriesStore(note, readable(0), {});
		let displayEntries: FullTableRow[];
		de$.subscribe((de) => (displayEntries = de));
		expect(displayEntries).toEqual([]);
	});
});
