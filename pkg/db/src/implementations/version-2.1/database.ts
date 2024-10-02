import { SQLocalKysely } from "sqlocal/kysely";
import { Kysely } from "kysely";

import { debug } from "@librocco/shared";

import type { DatabaseSchema } from "./types";
import { createReactive } from "./reactive";

export default (name: string) => {
	const { dialect, sql, createCallbackFunction } = new SQLocalKysely(name);
	const db = new Kysely<DatabaseSchema>({ dialect });

	const { stream, notify } = createReactive(db);

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

		const createWarehouseTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS warehouse (
			    id TEXT,
			    displayName TEXT,
			    discountPercentage INTEGER,
			    createdAt TEXT,
			    updatedAt TEXT,
				PRIMARY KEY (id)
			)`);
			await createReactiveTrigger("warehouse");
		};

		const createNoteTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS note (
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
			await createReactiveTrigger("note");
		};

		const createBookTransactionTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS book_transaction (
			    warehouseId TEXT,
			    noteId TEXT,
			    isbn TEXT,
			    quantity INTEGER,
			    updatedAt TEXT,
				PRIMARY KEY (warehouseId, noteId, isbn)
            )`);
			await createReactiveTrigger("book_transaction");
		};

		const createCustomItemTransactionTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS custom_item_transaction (
			    id TEXT,
			    noteId TEXT,
			    title TEXT,
			    price DECIMAL(5,2),
			    updatedAt TEXT,
				PRIMARY KEY (id)
            )`);
			await createReactiveTrigger("custom_item_transaction");
		};

		const createBookTable = async () => {
			await sql(`CREATE TABLE IF NOT EXISTS book (
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
			await createReactiveTrigger("book");
		};

		await createWarehouseTable();
		await createNoteTable();
		await createBookTransactionTable();
		await createCustomItemTransactionTable();
		await createBookTable();

		debug.log(ctx, "[db core init] done!")("");
	};

	return Object.assign(db, { init, stream, sql });
};
