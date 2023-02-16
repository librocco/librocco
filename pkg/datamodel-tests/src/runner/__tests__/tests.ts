import { expect } from 'vitest';

import { DesignDocument, CouchDocument, VolumeStock, VolumeTransactionTuple, WarehouseInterface } from '@librocco/db';
import { testUtils } from '@librocco/shared';

import { TestFunction } from '@/types';

import { firstValueFrom } from 'rxjs';

const { waitFor } = testUtils;

// A smoke test for the test runner
const runnerSmokeTests: TestFunction = async (db, version, getNotesAndWarehouses) => {
	// Full stock should be empty to begin with
	const fullStock = await firstValueFrom(db.warehouse().stream().entries);
	expect(fullStock).toEqual([]);

	// Loop through three notes, fill them with entries and commit them (we need to do this recursively as we can't await in a loop)
	const createCommitAndCheckNote = async (curr: number, last: number): Promise<void> => {
		if (curr > last) return;

		const { notes, fullStock, warehouses } = getNotesAndWarehouses(version)(curr + 1);

		const note = notes[curr];
		// If note is an inbound note, all books should be in the same warehouse, therefore we infer the warehouse from the first book.
		// If note is outbound, we use the default warehouse so the setup is trivial.
		const warehouse = note.type === 'inbound' ? db.warehouse(note.books[0].warehouseId) : db.warehouse();

		const n = await warehouse.note().create();
		await n.addVolumes(...note.books.map(({ isbn, quantity, warehouseId }) => [isbn, quantity, warehouseId] as VolumeTransactionTuple));
		await n.commit();

		const assertionTuples = [
			[db.warehouse(), fullStock.books] as [WarehouseInterface, VolumeStock[]],
			...warehouses.map(({ id, books }) => [db.warehouse(id), books] as [WarehouseInterface, VolumeStock[]])
		];
		const assertions = assertionTuples.map(([warehouse, books]) =>
			waitFor(async () => {
				const stock = await firstValueFrom(warehouse.stream().entries);
				expect(stock).toEqual(books);
			})
		);

		// Wait for assertions to pass.
		await Promise.all(assertions);

		// Continue with the next note
		return createCommitAndCheckNote(curr + 1, last);
	};

	await createCommitAndCheckNote(0, 2);
};

// A smoke test for uploading the design documents
const uploadDesignDocuments: TestFunction = async (db) => {
	// The 'docs/count' is used as a smoke test to validate 'db.updateDesignDoc'
	const docsCount: DesignDocument = {
		_id: '_design/docs',
		views: {
			count: {
				map: function (doc: CouchDocument) {
					emit(doc._id);
				}.toString(),
				reduce: '_count'
			}
		}
	};

	await db.updateDesignDoc(docsCount);

	// Create two docs
	const defaulWarehouse = await db.warehouse().create();
	await defaulWarehouse.note().create();

	const res = await db._pouch.query('docs/count', { reduce: true });
	const nDocs = res.rows[0].value;

	expect(nDocs).toEqual(2);
};

// We're running unit tests on a subset of final, full tests (for different datamodels)
export default {
	runnerSmokeTests,
	uploadDesignDocuments
};
