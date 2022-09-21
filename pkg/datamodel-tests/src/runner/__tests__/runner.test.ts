import { describe, expect } from 'vitest';

import { Runner } from '../runner';

import * as testDataLoader from './testDataLoader';

const allBooks = testDataLoader.getBooks();
const allNotes = testDataLoader.getNotes();

describe('Datamodel test runner smoke test', async () => {
	const runner = new Runner();
	await runner.loadData(testDataLoader);

	// Simple transform functions to test the tranform functionality
	runner.transformBooks((b) => ({ _id: b.volumeInfo.title }));
	runner.transformNotes((n) => ({ _id: n.id }));
	runner.transformSnap((s) => ({ _id: s.id }));

	runner.test('smoke test', async (books, getNotesAndSnaps) => {
		const transformedBooks = allBooks.map((b) => ({ _id: b.volumeInfo.title }));

		expect(books).toEqual(transformedBooks);

		const transformedNotes = allNotes.slice(0, 4).map((n) => ({ _id: n.id }));
		const transformedSnap = { _id: testDataLoader.getSnap(3).id };

		const { notes, snap } = getNotesAndSnaps(4);

		expect(notes).toEqual(transformedNotes);
		expect(snap).toEqual(transformedSnap);
	});
});
