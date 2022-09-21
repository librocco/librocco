import path from 'path';
import { describe, expect } from 'vitest';

import { Runner } from '../runner';

import book1 from '../__testData__/books/0007149522.json';
import book2 from '../__testData__/books/0061983411.json';
import book3 from '../__testData__/books/0071053646.json';
import book4 from '../__testData__/books/0080524230.json';
import book5 from '../__testData__/books/0194349276.json';
import book6 from '../__testData__/books/0195071409.json';
import book7 from '../__testData__/books/0195399706.json';
import book8 from '../__testData__/books/019976915X.json';
const allBooks = [book1, book2, book3, book4, book5, book6, book7, book8];

import note1 from '../__testData__/notes/note-000.json';
import note2 from '../__testData__/notes/note-001.json';
import note3 from '../__testData__/notes/note-002.json';
import note4 from '../__testData__/notes/note-003.json';
import note5 from '../__testData__/notes/note-004.json';
import note6 from '../__testData__/notes/note-005.json';
import note7 from '../__testData__/notes/note-006.json';
import note8 from '../__testData__/notes/note-007.json';
import note9 from '../__testData__/notes/note-008.json';
import note10 from '../__testData__/notes/note-009.json';
const allNotes = [note1, note2, note3, note4, note5, note6, note7, note8, note9, note10];

import snap1 from '../__testData__/snaps/note-000.json';
import snap2 from '../__testData__/snaps/note-001.json';
import snap3 from '../__testData__/snaps/note-002.json';
import snap4 from '../__testData__/snaps/note-003.json';
import snap5 from '../__testData__/snaps/note-004.json';
import snap6 from '../__testData__/snaps/note-005.json';
import snap7 from '../__testData__/snaps/note-006.json';
import snap8 from '../__testData__/snaps/note-007.json';
import snap9 from '../__testData__/snaps/note-008.json';
import snap10 from '../__testData__/snaps/note-009.json';
const allSnaps = [snap1, snap2, snap3, snap4, snap5, snap6, snap7, snap8, snap9, snap10];

describe('Datamodel test runner smoke test', async () => {
	const testDataDir = path.join(__dirname, '..', '__testData__');

	const runner = new Runner();
	await runner.loadData(testDataDir);

	// Simple transform functions to test the tranform functionality
	runner.transformBooks((b) => ({ _id: b.volumeInfo.title }));
	runner.transformNotes((n) => ({ _id: n.id }));
	runner.transformSnap((s) => ({ _id: s.id }));

	runner.test('smoke test', async (books, getNotesAndSnaps) => {
		const transformedBooks = allBooks.map((b) => ({ _id: b.volumeInfo.title }));

		expect(books).toEqual(transformedBooks);

		const transformedNotes = allNotes.slice(0, 4).map((n) => ({ _id: n.id }));
		const transformedSnap = { _id: allSnaps[3].id };

		const { notes, snap } = getNotesAndSnaps(4);

		expect(notes).toEqual(transformedNotes);
		expect(snap).toEqual(transformedSnap);
	});
});
