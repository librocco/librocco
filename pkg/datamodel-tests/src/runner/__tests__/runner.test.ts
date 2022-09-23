/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect } from 'vitest';

import { Runner } from '../runner';

import * as testDataLoader from './testDataLoader';

import exampleSetup from './example-pouch';

import { newDB } from '../../utils/pouchdb';

describe('Datamodel test runner smoke test', async () => {
	// We're instantiating the runner with the data loaded
	// for efficiency when running multiple tests
	const runner = new Runner();
	await runner.loadData(testDataLoader);

	describe('Example test', async () => {
		const { createDBInterface, ...transformers } = exampleSetup;

		const testSetup = runner.newSetup(transformers);

		testSetup.test('should work with pouchdb', async (_, getNotesAndWarehouses) => {
			const { notes, snap, warehouses } = getNotesAndWarehouses(1);

			// Instantiate a new DB to run tests against
			const db = await newDB();
			const { commitNote, getNotes, getStock, getWarehouses } = createDBInterface(db);

			// Commit all the notes loaded from test data
			await Promise.all(notes.map((n) => commitNote(n as any)));

			// Check notes retrieved from DB
			const resNotes = await getNotes();
			expect(resNotes).toEqual(notes);

			// Check full stock (all warehouses) retrieved from DB
			const resStock = await getStock();
			expect(resStock).toEqual(snap);

			// Check stocks per warehouse retrieved from DB
			const resWarehouses = await getWarehouses();
			expect(resWarehouses).toEqual(warehouses);
		});
	});
});
