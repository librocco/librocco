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

	test('should create display store from db and entries streams', async () => {
		const db = await newTestDB();

		await db.upsertBook({
			isbn: '0195399706',
			title: 'The Age of Wonder',
			authors: 'Richard Holmes',
			publisher: 'HarperCollins UK',
			year: '2008',
			price: 69.99
		});

		await db.upsertBook({
			isbn: '019976915X',
			title: 'Twelve Bar Blues',
			authors: 'Patrick Neate',
			publisher: 'Penguin UK',
			year: '2002',
			price: 39.86
		});

		await db.upsertBook({
			isbn: '0195071409',
			title: 'Saving Darwin',
			authors: 'Karl Giberson',
			publisher: 'Harper Collins',
			year: '2009',
			price: 22.0
		});
		const note = await db.warehouse().note('note-1').create();

		await note.addVolumes(
			['0195399706', 12, `v1/jazz`],
			['019976915X', 10, `v1/jazz`],
			['0195071409', 5, `v1/jazz`]
		);

		const de$ = createDisplayEntriesStore(db, note, readable(0), {});
		let displayEntries: DisplayRow[];
		de$.subscribe((de) => (displayEntries = de));
		const want = [
			{
				isbn: '0195071409',
				quantity: 5,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found',
				title: 'Saving Darwin',
				authors: 'Karl Giberson',
				publisher: 'Harper Collins',
				year: '2009',
				price: 22.0
			},

			{
				isbn: '0195399706',
				quantity: 12,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found',
				title: 'The Age of Wonder',
				authors: 'Richard Holmes',
				publisher: 'HarperCollins UK',
				year: '2008',
				price: 69.99
			},
			{
				isbn: '019976915X',
				quantity: 10,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found',
				title: 'Twelve Bar Blues',
				authors: 'Patrick Neate',
				publisher: 'Penguin UK',
				year: '2002',
				price: 39.86
			}
		];

		await waitFor(() => expect(displayEntries).toEqual(want));
	});

	test('should create display store only from entries streams if corresponding books do not exist', async () => {
		const db = await newTestDB();

		await db.upsertBook({
			isbn: '0195399706',
			title: 'The Age of Wonder',
			authors: 'Richard Holmes',
			publisher: 'HarperCollins UK',
			year: '2008',
			price: 69.99
		});

		await db.upsertBook({
			isbn: '0195071409',
			title: 'Saving Darwin',
			authors: 'Karl Giberson',
			publisher: 'Harper Collins',
			year: '2009',
			price: 22.0
		});
		const note = await db.warehouse().note('note-1').create();

		await note.addVolumes(
			['0195399706', 12, `v1/jazz`],
			['019976915X', 10, `v1/jazz`],
			['0195071409', 5, `v1/jazz`]
		);

		const de$ = createDisplayEntriesStore(db, note, readable(0), {});
		let displayEntries: DisplayRow[];
		de$.subscribe((de) => (displayEntries = de));
		const want = [
			{
				isbn: '0195071409',
				quantity: 5,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found',
				title: 'Saving Darwin',
				authors: 'Karl Giberson',
				publisher: 'Harper Collins',
				year: '2009',
				price: 22.0
			},

			{
				isbn: '0195399706',
				quantity: 12,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found',
				title: 'The Age of Wonder',
				authors: 'Richard Holmes',
				publisher: 'HarperCollins UK',
				year: '2008',
				price: 69.99
			},
			{
				isbn: '019976915X',
				quantity: 10,
				warehouseId: `v1/jazz`,
				warehouseName: 'not-found'
			}
		];

		await waitFor(() => expect(displayEntries).toEqual(want));
	});

	test('should return book if found and undefined otherwise', async () => {
		const db = await newTestDB();

		const book1 = {
			isbn: '0195399706',
			title: 'The Age of Wonder',
			authors: 'Richard Holmes',
			publisher: 'HarperCollins UK',
			year: '2008',
			price: 69.99
		};

		await db.upsertBook(book1);

		const book1Found = await db.getBook('0195399706');

		const bookUndefined = await db.getBook('019976915X');

		await waitFor(() => expect(book1Found).toEqual(book1));
		await waitFor(() => expect(bookUndefined).toBeUndefined());

		const book2 = {
			isbn: '019976915X',
			title: 'Twelve Bar Blues',
			authors: 'Patrick Neate',
			publisher: 'Penguin UK',
			year: '2002',
			price: 39.86
		};

		await db.upsertBook(book2);

		const book2Found = await db.getBook('019976915X');

		await waitFor(() => expect(book2Found).toEqual(book2));
	});
});
