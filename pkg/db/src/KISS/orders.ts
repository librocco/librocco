import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const dbCache: { [key: string]: SQLite3.oo1.DB } = {};

export async function getDB(dbname: string): Promise<SQLite3.oo1.DB> {
	if (dbCache[dbname]) {
		return dbCache[dbname];
	}

	const sqlite3 = await sqlite3InitModule();
	const db = new sqlite3.oo1.DB(`opfs:${dbname}`, "c");
	dbCache[dbname] = db;
	return db;
}

export async function initializeDB(db) {
	await db.exec(`CREATE TABLE IF NOT EXISTS customer (
		id INTEGER,
		fullname TEXT,
		email TEXT,
		deposit DECIMAL,
		PRIMARY KEY (id)
	)`);
}

export async function getAllCustomers(db) {
	const result = await db.exec("SELECT id, fullname, email, deposit FROM customer;");
	debugger;
	return result;
}
