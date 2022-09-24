/* eslint-disable @typescript-eslint/no-explicit-any */
import { CouchDocument, CreateDBInterface, DesignDocument, TestSetup } from '@/types';
import { Stock } from './types';

import exampleSetup from '@unit-tests/datamodels/example-pouch';

import { createDBInteractions, createGetWarehouses } from '@/utils/test-setup';
import { unwrapDocs, sortById } from '@/utils/pouchdb';

// This design document is essentially pointless, but is here
// to test out the design document uploading working
const designDocuments: DesignDocument[] = [
	{
		_id: '_design/warehouses',
		views: {
			all: {
				map: function (doc: CouchDocument) {
					if (['science', 'jazz'].includes(doc._id)) {
						emit(doc._id);
					}
				}.toString()
			}
		}
	}
];

const getWarehouses = createGetWarehouses((db) => async () => {
	const res = await db.query('warehouses/all', {
		include_docs: true
	});
	const warehouses = (unwrapDocs(res) as Stock[])
		.map((warehouse) => ({
			...warehouse,
			books: warehouse.books.sort(sortById)
		}))
		.sort(sortById);
	return warehouses;
});

// We're using example setup with a few overrides
const createDBInterface: CreateDBInterface = (db: PouchDB.Database) => ({
	...exampleSetup.createDBInterface(db),
	...createDBInteractions({
		getWarehouses
	} as Parameters<typeof createDBInteractions>[0])(db)
});

export default {
	...exampleSetup,
	designDocuments,
	createDBInterface
} as TestSetup;
