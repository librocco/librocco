import { browser } from "$app/environment";
import * as ss from "superstruct";
import { crr, primary } from "crstore";
import { database } from "crstore/svelte";
import { goto } from "./utils/navigation";
import { appPath } from "./paths";
import type { WarehouseData } from "@librocco/db";
import { map, Observable } from "rxjs";
import { asc } from "@librocco/shared";
import type { Readable } from "svelte/store";

let db: ReturnType<typeof createSQLite> | null = null;
const createSQLite = () => database(schema, { name: "temp" });

export const getSQLite = () => {
	if (browser) {
		db = createSQLite();
	}
	return db;
};

// #region schema
const warehouseSchema = crr(
	primary(
		ss.object({
			id: ss.string(),
			displayName: ss.string(),
			discountPercentage: ss.number(),

			createdAt: ss.string(),
			updatedAt: ss.string()
		}),
		"id"
	)
);

// const noteSchema = crr(
// 	primary(
// 		ss.object({
// 			id: ss.string(),
// 			warehouseId: ss.string(),
//
// 			noteType: ss.string(),
//
// 			committed: ss.number(),
// 			deleted: ss.number(),
//
// 			displayName: ss.string(),
// 			defaultWarehouse: ss.optional(ss.string()),
// 			reconciliationNote: ss.number(),
//
// 			createdAt: ss.string(),
// 			updatedAt: ss.string(),
// 			committedAt: ss.optional(ss.string())
// 		}),
// 		"id",
// 		"warehouseId"
// 	)
// );
//
// const bookTransctionSchema = crr(
// 	primary(
// 		ss.object({
// 			warehouseId: ss.string(),
// 			noteId: ss.string(),
//
// 			isbn: ss.string(),
// 			quantity: ss.number(),
//
// 			updatedAt: ss.string()
// 		}),
// 		"isbn",
// 		"noteId",
// 		"warehouseId"
// 	)
// );
//
// const customItemTransactionSchema = crr(
// 	primary(
// 		ss.object({
// 			noteId: ss.string(),
//
// 			id: ss.string(),
// 			title: ss.string(),
// 			price: ss.number(),
//
// 			updatedAt: ss.string()
// 		}),
// 		"id",
// 		"noteId"
// 	)
// );
//
// const bookDataSchema = crr(
// 	primary(
// 		ss.object({
// 			isbn: ss.string(),
// 			title: ss.optional(ss.string()),
// 			price: ss.optional(ss.number()),
// 			year: ss.optional(ss.string()),
// 			authors: ss.optional(ss.string()),
// 			publisher: ss.optional(ss.string()),
// 			editedBy: ss.optional(ss.string()),
// 			outOfPrint: ss.optional(ss.number()),
// 			category: ss.optional(ss.string()),
// 			updatedAt: ss.optional(ss.string())
// 		}),
// 		"isbn"
// 	)
// );

export const schema = ss.object({
	warehouses: warehouseSchema
	// notes: noteSchema,
	// bookTransactions: bookTransctionSchema,
	// customItemTransactions: customItemTransactionSchema,
	// books: bookDataSchema
});

// #region impl

export const handleCreateWarehouse = async () => {
	const id = new Date().toISOString();

	// const seq = await this._getNameSeq();
	const seq = 1;
	const displayName = seq === 1 ? "New Warehouse" : `New Warehouse (${seq})`;

	await getSQLite().update((db) =>
		db
			.insertInto("warehouses")
			.values({ id, displayName, discountPercentage: 0 })
			.onConflict((oc) => oc.doNothing())
			.execute()
	);

	// const warehouse = this.get();
	const conn = await getSQLite().connection;
	const warehouse = await conn.selectFrom("warehouses").where("id", "==", id).selectAll().executeTakeFirst();

	await goto(appPath("warehouses", warehouse.id));
};

export const getWarehouse = async (id: string): Promise<WarehouseData> => {
	const conn = await getSQLite().connection;
	const warehouse = await conn.selectFrom("warehouses").where("id", "==", id).selectAll().executeTakeFirst();
	return warehouse;
};

export const observableFromStore = <T>(store: Readable<T>): Observable<T> => {
	return new Observable((subscriber) => {
		const unsubscribe = store.subscribe((value) => {
			subscriber.next(value);
		});
		return unsubscribe;
	});
};

// TODO: implement this on the db interface + add unit test
export const handleDeleteWarehouse = (id: string) => {
	console.log("handleDeleteWarehouse", id);
	return getSQLite()?.update((db) => db.deleteFrom("warehouses").where("id", "==", id).execute());
};

// #region streams

// Note: Streams seem to be the most problematic part of the app
export const streamWarehouseMap = () => {
	const db = getSQLite();
	if (!db) return undefined;

	return observableFromStore(
		db.replicated((db) => db.selectFrom("warehouses").select(["id", "displayName", "updatedAt", "discountPercentage"]))
	).pipe(
		// Add a default "all" (pseudo) warehouse
		map((rows) => [{ id: "all", displayName: "All", discountPercentage: 0 }, ...rows]),
		map((rows) => rows.sort(asc(({ id }) => id))),
		map((rows) => new Map(rows.map((r) => [r.id, { ...r, totalBooks: 0 }])))
	);
};
