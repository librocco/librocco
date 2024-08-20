import type { Page } from "@playwright/test";

import type { InventoryDatabaseInterface, WarehouseData } from "@librocco/db";

/**
 * Returns the database handle from the db interface registered in the window object
 * of the app. We can run `hadle.evaluate` to run queries/mutations against the database.
 * @example
 * ```ts
 * const dbHandle = await getDbHandle(page);
 *
 * // Use the handle to create a warehouse in the db
 * await dbHandle.evaluate(async (db) => {
 *   await db.warehouse("foo-wh").create()
 * })
 * ```
 */
export function getDbHandle(page: Page) {
	return page.evaluateHandle(async () => {
		const w = window as { [key: string]: any };

		// Wait for the db to become initialised
		await new Promise<void>((res) => {
			if (w["db_ready"]) {
				return res();
			} else {
				// Creating a separate function, as we want to run the listener only once and then remove it
				const finalise = () => {
					window.removeEventListener("db_ready", finalise), res();
				};
				window.addEventListener("db_ready", finalise);
			}
		});

		return w["_db"] as InventoryDatabaseInterface;
	});
}

// #region TEMP
export function getDbHandleTemp(page: Page) {
	return page.evaluateHandle(async () => {
		const w = window as { [key: string]: any };

		// Wait for the db to become initialised
		await new Promise<void>((res) => {
			if (w["db_ready_temp"]) {
				return res();
			} else {
				// Creating a separate function, as we want to run the listener only once and then remove it
				const finalise = () => {
					window.removeEventListener("db_ready_temp", finalise), res();
				};
				window.addEventListener("db_ready_temp", finalise);
			}
		});

		return w["_db_temp"] as SQLiteDB;
	});
}

type DBHandleTemp = Awaited<ReturnType<typeof getDbHandleTemp>>;

export const handleCreateWarehouse = async (dbHandle: DBHandleTemp, _id?: string) => {
	const id = _id || new Date().toISOString();

	await dbHandle.evaluate((db, id) => {
		// const seq = await this._getNameSeq();
		const seq = 1;
		const displayName = seq === 1 ? "New Warehouse" : `New Warehouse (${seq})`;

		db.update((db) =>
			db
				.insertInto("warehouses")
				.values({ id, displayName, discountPercentage: 0 })
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
	}, id);

	// const warehouse = this.get();
	return getWarehouse(dbHandle, id);
};

export const getWarehouse = async (dbHandle: DBHandleTemp, id: string): Promise<WarehouseData> =>
	dbHandle.evaluate(async (db, id) => {
		const conn = await db.connection;
		const warehouse = await conn.selectFrom("warehouses").where("id", "==", id).selectAll().executeTakeFirst();
		return warehouse;
	}, id);

export const setWarehouseName = async (dbHandle: DBHandleTemp, id: string, name: string) => {
	await handleCreateWarehouse(dbHandle, id);
	await dbHandle.evaluate(
		(db, [id, name]) => db.update((db) => db.updateTable("warehouses").set({ displayName: name }).where("id", "==", id).execute()),
		[id, name] as const
	);
	return getWarehouse(dbHandle, id);
};

// TODO: remove superstruct and crstore when done with TEMP
import * as ss from "superstruct";
import { crr, primary, Schema } from "crstore";
import type { SvelteDatabase } from "crstore/dist/svelte";

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

const noteSchema = crr(
	primary(
		ss.object({
			id: ss.string(),
			warehouseId: ss.string(),

			noteType: ss.string(),

			committed: ss.number(),
			deleted: ss.number(),

			displayName: ss.string(),
			defaultWarehouse: ss.optional(ss.string()),
			reconciliationNote: ss.number(),

			createdAt: ss.string(),
			updatedAt: ss.string(),
			committedAt: ss.optional(ss.string())
		}),
		"id",
		"warehouseId"
	)
);

const bookTransctionSchema = crr(
	primary(
		ss.object({
			warehouseId: ss.string(),
			noteId: ss.string(),

			isbn: ss.string(),
			quantity: ss.number(),

			updatedAt: ss.string()
		}),
		"isbn",
		"noteId",
		"warehouseId"
	)
);

const customItemTransactionSchema = crr(
	primary(
		ss.object({
			noteId: ss.string(),

			id: ss.string(),
			title: ss.string(),
			price: ss.number(),

			updatedAt: ss.string()
		}),
		"id",
		"noteId"
	)
);

const bookDataSchema = crr(
	primary(
		ss.object({
			isbn: ss.string(),
			title: ss.optional(ss.string()),
			price: ss.optional(ss.number()),
			year: ss.optional(ss.string()),
			authors: ss.optional(ss.string()),
			publisher: ss.optional(ss.string()),
			editedBy: ss.optional(ss.string()),
			outOfPrint: ss.optional(ss.number()),
			category: ss.optional(ss.string()),
			updatedAt: ss.optional(ss.string())
		}),
		"isbn"
	)
);

export const schema = ss.object({
	warehouses: warehouseSchema,
	notes: noteSchema,
	bookTransactions: bookTransctionSchema,
	customItemTransactions: customItemTransactionSchema,
	books: bookDataSchema
});

type DatabaseSchema = typeof schema;
export type SQLiteDB = SvelteDatabase<Schema<DatabaseSchema>>;
