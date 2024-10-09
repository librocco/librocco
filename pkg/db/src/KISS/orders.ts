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
		FOREIGN KEY (customer_id) REFERENCES customer(id)
	)`);
}

export async function getAllCustomers(db) {
	const result = await db.exec({
		sql: "SELECT id, fullname, email, deposit FROM customer ORDER BY id ASC;",
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
		$id: customer.id,
		$fullname: customer.fullname,
		$email: customer.email,
		$deposit: customer.deposit
	};

	await db.exec({
		sql: `INSERT INTO customer (id, fullname, email, deposit)
        VALUES ($id, $fullname, $email, $deposit)
        ON CONFLICT(id) DO UPDATE SET
          fullname = $fullname,
          email = $email,
          deposit = $deposit;`,
		bind: params,
		returnValue: "resultRows"
	});
}

export const getCustomerBooks = async (db, customerId) => {
	const result = await db.exec({
		sql: "SELECT isbn, quantity FROM customer_order_lines WHERE customer_id = $customerId ORDER BY id ASC;",
		bind: { $customerId: customerId },
		returnValue: "resultRows"
	});
	return result.map((row) => {
		return {
			isbn: row[0],
			quantity: row[1]
		};
	});
	return [];
};

export const addBooksToCustomer = async (db, customerId, books) => {
	// books is a list of { isbn, quantity }
	const params = books.map((book) => [customerId, book.isbn, book.quantity]).flat();
	const sql =
		`INSERT INTO customer_order_lines (customer_id, isbn, quantity)
    VALUES ` + multiplyString("( ?, ?, ? )", books.length);
	await db.exec({
		sql: sql,
		bind: params,
		returnValue: "resultRows"
	});
};

// Example: multiplyString("foo", 5) → "foo, foo, foo, foo, foo"
const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
