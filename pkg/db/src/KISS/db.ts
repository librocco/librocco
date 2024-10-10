import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

type SQLite3 = any; // I cheated, I know!

const dbCache: { [key: string]: SQLite3 } = {};

export async function getDB(dbname: string) {
	if (dbCache[dbname]) {
		return dbCache[dbname];
	}

	const sqlite3 = await sqlite3InitModule();
	const db = new sqlite3.oo1.DB(`opfs:${dbname}`, "c");
	dbCache[dbname] = db;
	return db;
}

export async function initializeDB(db) {
	await db.exec(`CREATE TABLE customer (
		id INTEGER,
		fullname TEXT,
		email TEXT,
		deposit DECIMAL,
		PRIMARY KEY (id)
	)`);
	await db.exec(`CREATE TABLE IF NOT EXISTS customer_order_lines (
		id INTEGER,
		customer_id TEXT,
		isbn TEXT,
		quantity INTEGER,
		created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		placed TIMESTAMP,
		received TIMESTAMP,
		collected TIMESTAMP,
		PRIMARY KEY (id),
		FOREIGN KEY (customer_id) REFERENCES customer(id) ON UPDATE CASCADE ON DELETE CASCADE
	)`);
}

export const getInitializedDB = async (dbname: string) => {
	const db = await getDB(dbname);
	// Check if it's already initialized
	const result = await db.exec({
		sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='customer';",
		returnValue: "resultRows"
	});
	if (result.length === 0) {
		await initializeDB(db);
	}
	return db;
};
