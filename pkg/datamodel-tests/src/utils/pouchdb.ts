/* eslint-disable @typescript-eslint/no-explicit-any */
import PouchDb from 'pouchdb';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import { CouchDocument } from '../types';

/**
 * Creates a new pouch db database instance. The instances are stored in `.test-dbs`
 * folder at the root of the repo. If the directory doesn't exist, it's created.
 *
 * The db is instantiated with a uuid generated name, not to produce conflicts while testing.
 * @returns the db instance
 */
export const newDB = async (): Promise<PouchDB.Database> => {
	const dbDirName = '.test-dbs';

	// Check if the folder for test dbs is created
	const testDBPath = path.join(process.cwd(), dbDirName);
	try {
		fs.readdirSync(testDBPath);
	} catch (err) {
		// If the folder dosen't exist, create it
		if ((err as any).code === 'ENOENT') {
			fs.mkdirSync(testDBPath);
		} else {
			// Throw for other errors
			throw err;
		}
	}

	// Create a new db with random name (to avoid conflicts while testing)
	const name = randomUUID();
	const dbPath = [dbDirName, name].join('/');
	const db = new PouchDb(dbPath);

	// Create an entry for full stock in the db
	await db.put({ _id: 'all-warehouses', books: [] });
	return db;
};

/**
 * Takes in a response from the `PouchDB.allDocs`, maps through the
 * "rows" and extracts `doc` from each row. If the `doc` doesn't exist,
 * the entry is omitted from the result.
 *
 * _note: in order for this to work, `include_docs` option should be passed to
 * the pouchdb query._
 * @param res a result received from `PouchDB.allDocs({...options, include_docs: true})`
 * @returns and array of `doc` entries from each pouchdb "row", excluding the `_rev` (including `_id`)
 */
export const unwrapDocs = (res: PouchDB.Core.AllDocsResponse<Record<string, any>>) =>
	res.rows.reduce((acc, { doc }) => {
		if (!doc) {
			return acc;
		}
		return [...acc, unwrapDoc(doc)];
	}, [] as CouchDocument[]);

/**
 * Unwraps a pouch db doc by removing `_rev` field (we use this to compare documents)
 * @param doc pouch db document (including `_rev` and `_id`)
 * @returns the provided document without the `_rev` field (including `_id`)
 */
export const unwrapDoc = (doc: PouchDB.Core.IdMeta & PouchDB.Core.GetMeta): CouchDocument => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { _rev, ...document } = doc;
	return document;
};
