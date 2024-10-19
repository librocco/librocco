import fs from "fs";
import path from "path";
import SQLite, { Database } from "better-sqlite3";
import { extensionPath } from "@vlcn.io/crsqlite";

/** Creates a bare minimum SQLite instance and adds CR-SQLite extension */
export function newDB(fpath: string) {
	const database = new SQLite(fpath);
	return database;
}

export function initializeDB(db: Database) {
	// Load the CR-SQLite extension
	db.loadExtension(extensionPath);

	db.exec(`CREATE TABLE IF NOT EXISTS customer (
		id INTEGER NOT NULL,
		fullname TEXT,
		email TEXT,
		deposit DECIMAL,
		PRIMARY KEY (id)
	)`);
	db.exec(`CREATE TABLE IF NOT EXISTS customer_order_lines (
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

	// Activate the crsql extension
	db.exec("SELECT crsql_as_crr('customer');");
	db.exec("SELECT crsql_as_crr('customer_order_lines');");
}

export const getInitializedDB = async (fpath: string) => {
	// Ensure the directory exists
	const dir = path.dirname(fpath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	const db = newDB(fpath);
	const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customer';").get();

	if (!result) {
		initializeDB(db);
	}
	return db;
};
