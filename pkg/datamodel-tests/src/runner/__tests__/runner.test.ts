import { describe, expect } from 'vitest';

import { RawBook, RawDBSnap } from '../../types/raw-data';

import { Runner } from '../runner';

import * as testDataLoader from './testDataLoader';

describe('Datamodel test runner smoke test', async () => {
	const allBooks = await testDataLoader.getBooks();
	const allNotes = await testDataLoader.getNotes();

	// We're instantiating the runner with the data loaded
	// for efficiency when running multiple tests
	const runner = new Runner();
	await runner.loadData(testDataLoader);

	describe('Transform case 1', () => {
		// Simple transform functions to test the tranform functionality
		const idByTitle = (b: RawBook) => {
			return { _id: b.volumeInfo.title };
		};
		const extractIdAndBooks = (s: RawDBSnap) => ({ _id: s.id, books: s.books.map(idByTitle) });

		const testCase = runner.newCase({
			transformBooks: idByTitle,
			transformNotes: (n) => ({ _id: n.id }),
			transformSnaps: extractIdAndBooks,
			mapWarehouses: (b, addToWarehouse) => addToWarehouse(b.warehouse, b)
		});

		testCase.test('smoke test 1', async (books, getNotesAndSnaps) => {
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

	describe('Transformation 2', () => {
		const getISBN = (b: RawBook) =>
			Object.values(b.volumeInfo.industryIdentifiers).find(({ type }) => type === 'ISBN_10')
				?.identifier || 'isbn_unknown';

		// Try a different transformation then the one above
		const testCase = runner.newCase({
			transformBooks: (b) => ({ _id: getISBN(b) }),
			transformNotes: (n) => ({ _id: n.id }),
			transformSnaps: (s) => ({ _id: s.id }),
			mapWarehouses: () => {
				//
			}
		});

		testCase.test('Different transformation', async (books) => {
			// We're testing the books against the same transform function as the
			// transformation being applied is enough for this case
			const transformedBooks = allBooks.map((b) => ({ _id: getISBN(b) }));
			expect(books).toEqual(transformedBooks);
		});
	});
});
