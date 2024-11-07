import initWasm from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import { cryb64 } from "@vlcn.io/ws-common";

import schema from "@librocco/shared/db-schemas/orders.sql?raw";

import { type DB, type Change } from "./types";

const schemaName = "orders";
const schemaVersion = cryb64(schema);

const dbCache: Record<string, DB> = {};

async function getSchemaNameAndVersion(db: DB): Promise<[string, bigint] | null> {
	const nameRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_name'");
	if (!nameRes?.length) return null;
	const [[name]] = nameRes;

	const versionRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_version'");
	if (!versionRes?.length) throw new Error(`db has a schema name: ${name}, but no version`);
	const [[version]] = versionRes;

	return [name, BigInt(version)];
}

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
	// Thought: This could probably be wrapped into a txn
	// not really: transactions are for DML, not for DDL
	// Apply the schema (initialise the db)
	await db.exec(schema);


	// Store schema info in crsql_master
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_name", schemaName]);
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_version", schemaVersion]);

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
}

export const getInitializedDB = async (dbname: string) => {
	const db = await getDB(dbname);

	const result = await db.execO(`SELECT name FROM sqlite_master WHERE type='table' AND name='customer';`);

	const schemaRes = await getSchemaNameAndVersion(db);
	if (!schemaRes) {
		await initializeDB(db);
		return db;
	}

	// Check if schema name/version match
	const [name, version] = schemaRes;
	if (name !== schemaName || version !== schemaVersion) {
		// TODO: We're throwing an error here on mismatch. Should probably be handled in a more delicate manner.
		const msg = [
			"DB name/schema mismatch:",
			`  req name: ${schemaName}, got name: ${name}`,
			`  req version: ${schemaVersion}, got version: ${version}`
		].join("\n");
		throw new Error(msg);
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
