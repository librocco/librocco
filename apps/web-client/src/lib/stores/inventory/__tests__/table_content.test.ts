import { describe, test, expect } from 'vitest';
import { testUtils } from '@librocco/shared';

import type { PaginationData, DisplayRow } from '$lib/types/inventory';

import { createDisplayEntriesStore, createPaginationDataStore } from '../table_content';

import type { VolumeQuantity } from '$lib/types/db';
import { readable } from 'svelte/store';
import { newTestDB } from '$lib/__testUtils__/db';
const { waitFor } = testUtils;

describe('tableContentStore', () => {
	test("should not explode if no 'entity' is provided", async () => {
		const db = await newTestDB();

		const de$ = createDisplayEntriesStore(db, undefined, readable(0), {});
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

	test('should stream book data with the entires (matching their isbn)', async () => {
		// both are undefined

		const deUndefinedDb$ = createDisplayEntriesStore(undefined, undefined, readable(0), {});

		let displayEntriesUndefinedDb: DisplayRow[];
		deUndefinedDb$.subscribe((de) => (displayEntriesUndefinedDb = de));
		await waitFor(() => expect(displayEntriesUndefinedDb).toEqual([]));

		// db is defined but not entity
		const db = await newTestDB();

		const deUndefinedEntity$ = createDisplayEntriesStore(db, undefined, readable(0), {});

		let displayEntriesUndefinedEntity: DisplayRow[];
		deUndefinedEntity$.subscribe((de) => (displayEntriesUndefinedEntity = de));

		await waitFor(() => expect(displayEntriesUndefinedEntity).toEqual([]));

		// both are defined

		const book1Promise = db.upsertBook({
			isbn: '0195399706',
			title: 'The Age of Wonder',
			authors: 'Richard Holmes',
			publisher: 'HarperCollins UK',
			year: '2008',
			price: 69.99
		});

		const book2Promise = db.upsertBook({
			isbn: '019976915X',
			title: 'Twelve Bar Blues',
			authors: 'Patrick Neate',
			publisher: 'Penguin UK',
			year: '2002',
			price: 39.86
		});

		const note = await db.warehouse().note('note-1').create();

		const volumesPromise = note.addVolumes(['0195399706', 12, `v1/jazz`], ['019976915X', 10, `v1/jazz`]);

		Promise.all([book1Promise, book2Promise, volumesPromise]);

		const de$ = createDisplayEntriesStore(db, note, readable(0), {});
		let displayEntries: DisplayRow[];
		de$.subscribe((de) => (displayEntries = de));
		const book1 = {
			title: 'The Age of Wonder',
			authors: 'Richard Holmes',
			publisher: 'HarperCollins UK',
			year: '2008',
			price: 69.99
		};
		const book2 = {
			isbn: '019976915X',

			title: 'Twelve Bar Blues',
			authors: 'Patrick Neate',
			publisher: 'Penguin UK',
			year: '2002',
			price: 39.86
		};

		const want = [
			{
				...book1,
				isbn: '0195399706',
				quantity: 12,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found'
			},

			{
				...book2,
				quantity: 10,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found'
			}
		];

		await waitFor(() => expect(displayEntries).toEqual(want));
	});

	test('should stream just the volume stock if for isbns with no book data found', async () => {
		const db = await newTestDB();

		const book1 = {
			isbn: '0195399706',
			title: 'The Age of Wonder',
			authors: 'Richard Holmes',
			publisher: 'HarperCollins UK',
			year: '2008',
			price: 69.99
		};
		const book1Promise = db.upsertBook(book1);

		const note = await db.warehouse().note('note-1').create();

		const volumesPromise = note.addVolumes(['0195399706', 12, `v1/jazz`], ['019976915X', 10, `v1/jazz`]);

		const de$ = createDisplayEntriesStore(db, note, readable(0), {});
		let displayEntries: DisplayRow[];
		de$.subscribe((de) => (displayEntries = de));
		const want = [
			{
				...book1,
				quantity: 12,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found'
			},
			{
				isbn: '019976915X',
				quantity: 10,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found'
			}
		];
		await Promise.all([book1Promise, volumesPromise]);

		await waitFor(() => expect(displayEntries).toEqual(want));
	});
});
