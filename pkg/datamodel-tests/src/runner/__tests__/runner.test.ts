/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect } from 'vitest';

import { TestFunction } from '../../types';

import { newTestRunner } from '../runner';

import * as testDataLoader from './testDataLoader';

import exampleSetup from './example-pouch';

// This is how tests would be written and then ran with different setups
const exampleTest: TestFunction = async (data, db) => {
	const { notes, snap, warehouses } = data.getNotesAndWarehouses(5);

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

describe('Datamodel test runner smoke test', async () => {
	// We're instantiating the runner with the data loaded
	// for efficiency when running multiple tests
	const runner = await newTestRunner(testDataLoader);

	describe('Example test', async () => {
		const testSetup = runner.newModel(exampleSetup);
		testSetup.test('should work with pouchdb', exampleTest);
	});
});
