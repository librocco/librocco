/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect } from 'vitest';

import { newTestRunner } from '../runner';

import * as testDataLoader from './testDataLoader';

import exampleSetup from './example-pouch';

describe('Datamodel test runner smoke test', async () => {
	// We're instantiating the runner with the data loaded
	// for efficiency when running multiple tests
	const runner = await newTestRunner(testDataLoader);

	describe('Example test', async () => {
		const testSetup = runner.newModel(exampleSetup);

		testSetup.test('should work with pouchdb', async (data, db) => {
			const { notes, snap, warehouses } = data.getNotesAndWarehouses(1);

			// Commit all the notes loaded from test data
			await Promise.all(notes.map((n) => db.commitNote(n as any)));

			// Check notes retrieved from DB
			const resNotes = await db.getNotes();
			expect(resNotes).toEqual(notes);

			// Check full stock (all warehouses) retrieved from DB
			const resStock = await db.getStock();
			expect(resStock).toEqual(snap);

			// Check stocks per warehouse retrieved from DB
			const resWarehouses = await db.getWarehouses();
			expect(resWarehouses).toEqual(warehouses);
		});
	});
});
