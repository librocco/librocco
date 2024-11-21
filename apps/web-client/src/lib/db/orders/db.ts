import initWasm from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

import { type DB, type Change } from "./types";

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
	await db.exec(`CREATE TABLE book (
		isbn TEXT NOT NULL,
		title TEXT,
		authors TEXT,
		publisher TEXT,
		price DECIMAL,
		PRIMARY KEY (isbn)
	)`);
	await db.exec("SELECT crsql_as_crr('book');");

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
		created INTEGER DEFAULT (strftime('%s', 'now') * 1000),
		placed INTEGER,
		received INTEGER,
		collected INTEGER,
		PRIMARY KEY (id)
	)`);

	// We can't  specify the foreign key constraint since cr-sqlite doesn't support it:
	// Table customer_order_lines has checked foreign key constraints. CRRs may have foreign keys
	// but must not have checked foreign key constraints as they can be violated by row level security or replication.
	// FOREIGN KEY (customer_id) REFERENCES customer(id) ON UPDATE CASCADE ON DELETE CASCADE

	// Activate the crsql extension
	await db.exec("SELECT crsql_as_crr('customer');");
	await db.exec("SELECT crsql_as_crr('customer_order_lines');");

	await db.exec(`CREATE TABLE supplier (
		id INTEGER NOT NULL,
		name TEXT,
		email TEXT,
		address TEXT,
		PRIMARY KEY (id)
	)`);
	await db.exec("SELECT crsql_as_crr('supplier');");
	await db.exec(`CREATE TABLE supplier_publisher (
		supplier_id INTEGER,
		publisher TEXT NOT NULL,
		PRIMARY KEY (publisher)
	)`);
	await db.exec("SELECT crsql_as_crr('supplier_publisher');");

	await db.exec(`CREATE TABLE supplier_order (
	  id INTEGER NOT NULL,
		supplier_id INTEGER,
		created INTEGER DEFAULT (strftime('%s', 'now') * 1000),
		PRIMARY KEY (id)
	)`);
	await db.exec("SELECT crsql_as_crr('supplier_order');");
	await db.exec(`CREATE TABLE supplier_order_line (
		supplier_order_id INTEGER NOT NULL,
		isbn TEXT NOT NULL,
		quantity INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY (supplier_order_id, isbn)
	)`);
	await db.exec("SELECT crsql_as_crr('supplier_order_line');");

	await db.exec(`CREATE TABLE customer_supplier_order (
    id INTEGER NOT NULL,
		supplier_order_id INTEGER,
		customer_order_line_id INTEGER,
		PRIMARY KEY (id)
	)`);
	await db.exec("SELECT crsql_as_crr('customer_supplier_order');");

	await db.exec(`CREATE TABLE reconciliation_order (
    id INTEGER NOT NULL,
		supplier_order_ids TEXT CHECK (json_valid(supplier_order_ids) AND json_array_length(supplier_order_ids) >= 1),
		created INTEGER DEFAULT (strftime('%s', 'now') * 1000),
		customer_order_line_ids TEXT CHECK (json_valid(supplier_order_ids)),
		finalized INTEGER DEFAULT 0,
		PRIMARY KEY (id)
	)`);
	await db.exec("SELECT crsql_as_crr('reconciliation_order');");
}

export const getInitializedDB = async (dbname: string) => {
	const db = await getDB(dbname);

	const result = await db.execO(`SELECT name FROM sqlite_master WHERE type='table' AND name='customer';`);

	if (result.length === 0) {
		await initializeDB(db);
	}
	return db;
};

export const getChanges = (db: DB, since: bigint | null = BigInt(0)): Promise<Change[]> => {
	const query = `SELECT
	  "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"
	  FROM crsql_changes
		WHERE db_version > ? AND site_id = crsql_site_id();`;
	return db.execA(query, [since]) as any;
};

export const applyChanges = async (db: DB, changes: readonly Change[]) => {
	const query = `
	  INSERT INTO crsql_changes
			("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
	for (const change of changes) {
		await db.exec(query, change as any);
	}
};

export const getSiteId = async (db: DB): Promise<Uint8Array> => {
	// Return the site id of the passed database
	const siteid = (await db.execA(`SELECT quote(crsql_site_id())`))[0][0];
	return siteid.slice(2, -1); // remove X'' quoting
};

export const getDBVersion = async (db: DB): Promise<bigint> => {
	// Get the db version of changes done locally in the passed database
	const version = (await db.execA(`SELECT crsql_db_version()`))[0][0];
	return BigInt(version);
};

export const getPeerDBVersion = async (db: DB, siteId: Uint8Array): Promise<bigint> => {
	// Get the last db version of updates for the given peer site id
	const version = (await db.execA(`SELECT max(db_version) FROM crsql_changes WHERE site_id = ?`, [siteId]))[0][0];
	return version ? BigInt(version) : BigInt(0);
};
