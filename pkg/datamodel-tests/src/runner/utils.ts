/* eslint-disable @typescript-eslint/no-explicit-any */
import PouchDb from 'pouchdb';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

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