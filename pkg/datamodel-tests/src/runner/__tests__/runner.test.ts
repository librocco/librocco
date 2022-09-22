import { describe, expect } from 'vitest';

import { RawBook } from '../../types';

import { Runner } from '../runner';
import { defaultTransformBook, defaultTransformSnap } from '../testSetup';

import * as testDataLoader from './testDataLoader';

describe('Datamodel test runner smoke test', async () => {
	const allBooks = await testDataLoader.getBooks();
	const allNotes = await testDataLoader.getNotes();

	// We're instantiating the runner with the data loaded
	// for efficiency when running multiple tests
	const runner = new Runner();
	await runner.loadData(testDataLoader);

	describe('Dry run', () => {
		const testCase = runner.newSetup();

		testCase.test('smoke test', async (books, getNotesAndSnaps) => {
			const transformedBooks = allBooks.map(defaultTransformBook);

			expect(books).toEqual(transformedBooks);

			const transformedNotes = allNotes.map((n) => ({ _id: n.id }));
			const transformedSnap = defaultTransformSnap(testDataLoader.getSnap(9));

			const { notes, snap } = getNotesAndSnaps(10);

			expect(notes).toEqual(transformedNotes);
			expect(snap).toEqual(transformedSnap);
		});
	});

	describe('Transform books to use isbn as id and map to warehouses', () => {
		const getISBN = (b: RawBook) =>
			Object.values(b.volumeInfo.industryIdentifiers).find(({ type }) => type === 'ISBN_10')
				?.identifier || 'isbn_unknown';

		// Try a different transformation then the one above
		const testCase = runner.newSetup({
			transformBooks: (b) => ({ _id: getISBN(b) }),
			mapWarehouses: (b, addToWarehouse) => addToWarehouse(b.warehouse, b)
		});

		testCase.test(
			'should use isbn_10 as _id for a book and map books to appropriate warehouses',
			async (books, getNotesAndSnaps) => {
				// We're testing the books against the same transform function as the
				// transformation being applied is enough for this case
				const transformedBooks = allBooks.map((b) => ({ _id: getISBN(b) }));
				expect(books).toEqual(transformedBooks);

				const rawTestSnap = testDataLoader.getSnap(9);
				const scienceWarehouse = {
					_id: 'science',
					books: rawTestSnap.books.reduce(
						(acc, { warehouse, ...b }) =>
							warehouse === 'science' ? [...acc, defaultTransformBook(b)] : acc,
						[] as { _id: string }[]
					)
				};
				const jazzWarehouse = {
					_id: 'jazz',
					books: rawTestSnap.books.reduce(
						(acc, { warehouse, ...b }) =>
							warehouse === 'jazz' ? [...acc, defaultTransformBook(b)] : acc,
						[] as { _id: string }[]
					)
				};

				const {
					warehouses: { jazz, science }
				} = getNotesAndSnaps(10);
				expect(jazz).toEqual(jazzWarehouse);
				expect(science).toEqual(scienceWarehouse);
			}
		);
	});

	//	describe('A mock test against pouchdb', () => {});
});
