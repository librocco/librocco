/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'vitest';

import { TestFunction } from '../../types';

const createTest =
	(numNotes: number): TestFunction =>
	async (data, db) => {
		const { notes, snap, warehouses } = data.getNotesAndWarehouses(numNotes);

		// Commit all the notes loaded from test data
		for (const n of notes) {
			await db.commitNote(n as any);
		}

		// Check notes retrieved from DB
		const resNotes = await db.getNotes();
		expect(resNotes).toEqual(notes);

		// Check full stock (all warehouses) retrieved from DB
		const resStock = await db.getStock();
		expect(resStock).toEqual(snap);

		// Check stocks per warehouse retrieved from DB
		const resWarehouses = await db.getWarehouses();
		expect(resWarehouses).toEqual(warehouses);
	};

export const testOneNote = createTest(1);

export const testTenNotes = createTest(10);
