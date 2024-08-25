import { SQLocalKysely } from "sqlocal/kysely";
import { Kysely } from "kysely";

import type { DatabaseSchema } from "./types";
import { createReactive } from "./reactive";

export default (name: string) => {
	const { dialect, sql, createCallbackFunction } = new SQLocalKysely(`${name}.sqlite3`);
	const db = new Kysely<DatabaseSchema>({ dialect });

	const { stream, notify } = createReactive(db);

	const init = async () => {
		// Register an SQL function we're using to communicate the changes to reactive subscriptions
		await createCallbackFunction("logUpdate", notify);

		/**
		 * A function used to create INSERT, UPDATE and DESTROY triggers on the db (for convenience, less repetition).
		 * Every change to the table will communicate the change back to reactive subscriptions.
		 */
		const createReactiveTrigger = (table: string) =>
			// Three separate triggers as adding INSERT OR UPDATE OR DELETE was erroring out for some reason
			Promise.all([
				sql`CREATE TEMP TRIGGER log_${table}_insert AFTER INSERT ON ${table}
            BEGIN 
                SELECT logUpdate('${table}'); 
            END`,
				sql`CREATE TEMP TRIGGER log_${table}_update AFTER UPDATE ON ${table}
            BEGIN 
                SELECT logUpdate('${table}'); 
            END`,
				sql`CREATE TEMP TRIGGER log_${table}_delete AFTER DELETE ON ${table}
            BEGIN 
                SELECT logUpdate('${table}'); 
            END`
			]);

		const createWarehousesTable = async () => {
			await sql`CREATE TABLE IF NOT EXISTS warehouses (
			    id INTEGER PRIMARY KEY AUTOINCREMENT,
			    displayName TEXT,
			    discountPercentage INTEGER,
			    createdAt TEXT,
			    updatedAt TEXT
			)`;
			await createReactiveTrigger("warehouses");
		};

		const createNotesTable = async () => {
			await sql`CREATE TABLE IF NOT EXISTS notes (
			    id INTEGER PRIMARY KEY AUTOINCREMENT,
			    displayName TEXT,
			    warehouseId INTEGER,
			    noteType TEXT,
			    committed INTEGER,
			    deleted INTEGER,
			    defaultWarehouse TEXT,
			    reconciliationNote INTEGER,
			    createdAt TEXT,
			    updatedAt TEXT
			)`;
			await createReactiveTrigger("notes");
		};

		const createBookTransactionsTable = async () => {
			await sql`CREATE TABLE IF NOT EXISTS bookTransactions (
			    warehouseId INTEGER,
			    noteId INTEGER,
			    isbn TEXT,
			    quantity INTEGER,
			    updatedAt TEXT
            )`;
			await createReactiveTrigger("bookTransactions");
		};

		const createCustomItemTransactionsTable = async () => {
			await sql`CREATE TABLE IF NOT EXISTS customItemTransactions (
			    id INTEGER PRIMARY KEY AUTOINCREMENT,
			    noteId INTEGER,
			    title TEXT,
			    price DECIMAL(5,2),
			    updatedAt TEXT
            )`;
			await createReactiveTrigger("customItemTransactions");
		};

		const createBookDataTable = async () => {
			await sql`CREATE TABLE IF NOT EXISTS bookData (
			    isbn TEXT,
			    title TEXT,
			    price DECIMAL(5,2),
			    year TEXT,
			    authors TEXT,
			    publisher TEXT,
			    editedBy TEXT,
			    outOfPrint INTEGER,
			    category TEXT,
			    updatedAt TEXT
            )`;
			await createReactiveTrigger("bookData");
		};

		await Promise.all([
			createWarehousesTable(),
			createNotesTable(),
			createBookTransactionsTable(),
			createCustomItemTransactionsTable(),
			createBookDataTable()
		]);
	};

	return Object.assign(db, { init, stream });
};
