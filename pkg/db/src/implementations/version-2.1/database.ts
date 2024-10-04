import { SQLocalKysely } from "sqlocal/kysely";
import { Kysely } from "kysely";

import { debug } from "@librocco/shared";

import { DBConfigOpts } from "@/types";
import type { DatabaseSchema } from "./types";

import { createReactive } from "./reactive";

export default (name: string, opts?: DBConfigOpts) => {
	const { dialect, sql, createCallbackFunction } = new SQLocalKysely(name);
	const db = new Kysely<DatabaseSchema>({ dialect });

	const { stream, notify } = createReactive(db, undefined, opts.logLevel);

	const init = async (ctx: debug.DebugCtx = {}) => {
		debug.log(ctx, "[db core init] in progress...")("");
		// Register an SQL function we're using to communicate the changes to reactive subscriptions
		await createCallbackFunction("logUpdate", notify);
		debug.log(ctx, "[db core init] created the update function!")("");

		/**
		 * A function used to create INSERT, UPDATE and DESTROY triggers on the db (for convenience, less repetition).
		 * Every change to the table will communicate the change back to reactive subscriptions.
		 */
		const createReactiveTrigger = async (table: string) => {
			await sql(
				`CREATE TEMP TRIGGER log_${table}_insert AFTER INSERT ON ${table}
			         BEGIN
			             SELECT logUpdate('${table}');
			         END`
			);
			await sql(`CREATE TEMP TRIGGER log_${table}_update AFTER UPDATE ON ${table}
			         BEGIN
			             SELECT logUpdate('${table}');
			         END`);
			await sql(`CREATE TEMP TRIGGER log_${table}_delete AFTER DELETE ON ${table}
			         BEGIN
			             SELECT logUpdate('${table}');
			         END`);
		};

		const createWarehousesTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS warehouses (
			    id TEXT,
			    displayName TEXT,
			    discountPercentage INTEGER,
			    createdAt TEXT,
			    updatedAt TEXT,
				PRIMARY KEY (id)
			)`);
			await createReactiveTrigger("warehouses");
		};

		const createNotesTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS notes (
			    id TEXT,
			    displayName TEXT,
			    warehouseId TEXT,
			    noteType TEXT,
			    committed INTEGER,
			    deleted INTEGER,
			    defaultWarehouse TEXT,
			    reconciliationNote INTEGER,
			    createdAt TEXT,
			    updatedAt TEXT,
			    committedAt TEXT,
				PRIMARY KEY (id)
			)`);
			await sql(`CREATE INDEX IF NOT EXISTS notesIndex ON notes (warehouseId)`);
			await sql(`CREATE INDEX IF NOT EXISTS idx_notes_committed_id ON notes(committed, id)`);
			await sql(`CREATE INDEX IF NOT EXISTS idx_notes_committed_notetype_id ON notes(committed, noteType, id)`);
			await createReactiveTrigger("notes");
		};

		const createBookTransactionsTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS bookTransactions (
			    warehouseId TEXT,
			    noteId TEXT,
			    isbn TEXT,
			    quantity INTEGER,
			    updatedAt TEXT,
				PRIMARY KEY (warehouseId, noteId, isbn)
            )`);
			await sql(`CREATE INDEX IF NOT EXISTS bookTransactionsNoteIdIndex ON bookTransactions (isbn)`);
			await sql(
				`CREATE INDEX IF NOT EXISTS bookTransactionsIsbnNoteIdWarehouseIdQuantityIndex ON bookTransactions (isbn, noteId, warehouseId, quantity)`
			);
			await sql(`CREATE INDEX IF NOT EXISTS bookTransactionsNoteIdWarehouseIdIsbnIndex ON bookTransactions (noteId, warehouseId, isbn)`);
			// ChatGPT said this "covering index" would save a lookup since it provides all the necessary data for some queries
			await sql(`CREATE INDEX IF NOT EXISTS idx_cover_bookTransactions ON bookTransactions(warehouseId, isbn, quantity, noteId)`);
			await sql(`CREATE INDEX IF NOT EXISTS idx_cover_two_bookTransactions ON bookTransactions(noteId, warehouseId, isbn, quantity)`);
			await createReactiveTrigger("bookTransactions");
		};

		const createCustomItemTransactionsTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS customItemTransactions (
			    id TEXT,
			    noteId TEXT,
			    title TEXT,
			    price DECIMAL(5,2),
			    updatedAt TEXT,
				PRIMARY KEY (id)
            )`);
			await sql(`CREATE INDEX IF NOT EXISTS customItemTransactionsIndex ON customItemTransactions (noteId)`);
			await createReactiveTrigger("customItemTransactions");
		};

		const createBookDataTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS books (
			    isbn TEXT,
			    title TEXT,
			    price DECIMAL(5,2),
			    year TEXT,
			    authors TEXT,
			    publisher TEXT,
			    editedBy TEXT,
			    outOfPrint INTEGER,
			    category TEXT,
			    updatedAt TEXT,
				PRIMARY KEY (isbn)
            )`);
			await createReactiveTrigger("books");
		};

		await createWarehousesTable();
		await createNotesTable();
		await createBookTransactionsTable();
		await createCustomItemTransactionsTable();
		await createBookDataTable();

		debug.log(ctx, "[db core init] done!")("");
	};

	return Object.assign(db, { init, stream, sql });
};
