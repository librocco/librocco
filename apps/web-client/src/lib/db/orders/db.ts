import initWasm from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

import { type DB } from "./types";

const dbCache: Record<string, DB> = {};

export async function getDB(dbname: string) {
	if (dbCache[dbname]) {
		return dbCache[dbname];
	}

	const sqlite = await initWasm(() => wasmUrl);
	const db = await sqlite.open(dbname);

	dbCache[dbname] = db;
	return db;
}

export async function initializeDB(db: DB) {
	await db.exec(`CREATE TABLE customer (
		id INTEGER NOT NULL,
		fullname TEXT,
		email TEXT,
		deposit DECIMAL,
		PRIMARY KEY (id)
	)`);
	await db.exec(`CREATE TABLE customer_order_lines (
		id INTEGER NOT NULL,
		customer_id TEXT,
		isbn TEXT,
		quantity INTEGER,
		created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		placed TIMESTAMP,
		received TIMESTAMP,
		collected TIMESTAMP,
		PRIMARY KEY (id)
	)`);
	// We can't  specify the foreign key constraint since cr-sqlite doesn't support it:
	// Table customer_order_lines has checked foreign key constraints. CRRs may have foreign keys
	// but must not have checked foreign key constraints as they can be violated by row level security or replication.
	// FOREIGN KEY (customer_id) REFERENCES customer(id) ON UPDATE CASCADE ON DELETE CASCADE

	// Activate the crsql extension
	await db.exec("SELECT crsql_as_crr('customer');");
	await db.exec("SELECT crsql_as_crr('customer_order_lines');");
}

export const getInitializedDB = async (dbname: string) => {
	const db = await getDB(dbname);
	// Check if it's already initialized
	// TODO: check the return type
	const result = await db.execO("SELECT name FROM sqlite_master WHERE type='table' AND name='customer';");

	if (result.length === 0) {
		await initializeDB(db);
	}
	return db;
};
