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
	const result = await db.exec({
		sql: "SELECT id, fullname, email, deposit FROM customer;",
		returnValue: "resultRows"
	});
	return result.map((row) => {
		return {
			id: row[0],
			fullname: row[1],
			email: row[2],
			deposit: row[3]
		};
	});
}

export async function upsertCustomer(db, customer) {
	if (!customer.id) {
		throw new Error("Customer must have an id");
	}
	const params = {
		id: customer.id,
		fullname: customer.fullname,
		email: customer.email,
		deposit: customer.deposit
	};

	return await db.exec({
		sql: `INSERT INTO customer (id, fullname, email, deposit)
        VALUES (:id, :fullname, :email, :deposit)
        ON CONFLICT(id) DO UPDATE SET
          fullname = :fullname,
          email = :email,
          deposit = :deposit;`,
		params,
		returnValue: "resultRows"
	})[0];
}
