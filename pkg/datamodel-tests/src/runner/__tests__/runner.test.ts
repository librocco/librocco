import { describe, expect } from 'vitest';

import { RawBook, RawDBSnap } from '../../types/raw-data';

import { Runner } from '../runner';

import * as testDataLoader from './testDataLoader';

const allBooks = testDataLoader.getBooks();
const allNotes = testDataLoader.getNotes();

describe('Datamodel test runner smoke test', async () => {
	const runner = new Runner();
	await runner.loadData(testDataLoader);

	// Simple transform functions to test the tranform functionality
	const idByTitle = (b: RawBook) => {
		return { _id: b.volumeInfo.title };
	};
	const extractIdAndBooks = (s: RawDBSnap) => ({ _id: s.id, books: s.books.map(idByTitle) });

	runner.transformBooks(idByTitle);
	runner.transformNotes((n) => ({ _id: n.id }));
	runner.transformSnap(extractIdAndBooks);
	runner.mapWarehouses((b, addToWarehouse) => addToWarehouse(b.warehouse, b));

	runner.test('smoke test', async (books, getNotesAndSnaps) => {
		const transformedBooks = allBooks.map(idByTitle);

		expect(books).toEqual(transformedBooks);

		const rawTestSnap = testDataLoader.getSnap(9);

		const transformedNotes = allNotes.map((n) => ({ _id: n.id }));
		const transformedSnap = extractIdAndBooks(rawTestSnap);
		const scienceWarehouse = {
			_id: 'science',
			books: rawTestSnap.books.reduce(
				(acc, { warehouse, ...b }) => (warehouse === 'science' ? [...acc, idByTitle(b)] : acc),
				[] as { _id: string }[]
			)
		};
		const jazzWarehouse = {
			_id: 'jazz',
			books: rawTestSnap.books.reduce(
				(acc, { warehouse, ...b }) => (warehouse === 'jazz' ? [...acc, idByTitle(b)] : acc),
				[] as { _id: string }[]
			)
		};

		const {
			notes,
			snap,
			warehouses: { jazz, science }
		} = getNotesAndSnaps(10);

		expect(notes).toEqual(transformedNotes);
		expect(snap).toEqual(transformedSnap);
		expect(jazz).toEqual(jazzWarehouse);
		expect(science).toEqual(scienceWarehouse);
	});
});
