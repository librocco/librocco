import { sql } from "crstore";
import { filter, firstValueFrom, map } from "rxjs";

import { VolumeStockClient } from "@/types";
import { InventoryDatabaseInterface, WarehouseData, WarehouseInterface } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import { createNoteInterface } from "./note";

import { uniqueTimestamp } from "@/utils/misc";
import { observableFromStore } from "@/helpers";

export const createWarehouseInterface = (
	db: InventoryDatabaseInterface,
	_id?: string | typeof NEW_WAREHOUSE,
	data?: Partial<WarehouseData>
): WarehouseInterface => {
	const id: any = _id === NEW_WAREHOUSE ? uniqueTimestamp() : _id || "all";

	const createdAt: string | null = null;
	const updatedAt: string | null = null;

	let exists = false;

	let { displayName = "", discountPercentage = 0 } = data || {};

	// TODO: rewrite this as a single query
	const streamed = () => observableFromStore(db.replicated((db) => db.selectFrom("warehouses as w").selectAll())).pipe(map(([w]) => w));
	streamed()
		.pipe(filter(Boolean))
		.subscribe(({ displayName: _displayName, discountPercentage: _discountPercentage }) => {
			displayName = _displayName;
			discountPercentage = _discountPercentage;
			exists = true;
		});

	const streamedEntries = () =>
		observableFromStore(
			db.replicated((db) => {
				const stock = db
					.selectFrom("bookTransactions as t")
					.innerJoin("notes as n", "t.noteId", "n.id")
					.leftJoin("books as b", "t.isbn", "b.isbn")
					.leftJoin("warehouses as w", "t.warehouseId", "w.id")
					.where("t.warehouseId", "==", id)
					.where("n.committed", "==", true)
					.select([
						"t.isbn",
						"t.warehouseId",
						"w.displayName as warehouseName",
						"w.discountPercentage as warehouseDiscount",
						(qb) => qb.fn.sum<number>(sql`CASE WHEN n.noteType == 'inbound' THEN t.quantity ELSE -t.quantity END`).as("quantity")
					])
					.groupBy(["t.warehouseId", "t.isbn"]);

				// TODO: join book data here (instead of frontend)
				return db.selectFrom(stock.as("s")).where("s.quantity", "!=", 0).selectAll();
			})
		).pipe(map((x) => x as VolumeStockClient<"book">[]));

	const create = async () => {
		console.log("create");
		await db.connection.then((conn) =>
			conn
				.insertInto("warehouses")
				.values({ id, displayName: "", discountPercentage: 0 })
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
		console.log("created");
	};

	const setDiscount = (discount: number) =>
		db.update((db) =>
			db
				.insertInto("warehouses")
				.values({ id, discountPercentage: discount, displayName: "" })
				.onConflict((oc) => oc.doUpdateSet((du) => ({ discountPercentage: du.ref("excluded.discountPercentage") })))
				.execute()
		);

	const setName = (displayName: string) =>
		db.update((db) =>
			db
				.insertInto("warehouses")
				.values({ id, displayName, discountPercentage: 0 })
				.onConflict((oc) => oc.doUpdateSet((du) => ({ displayName: du.ref("excluded.displayName") })))
				.execute()
		);

	/** A helper used to await the updated data (after an update) and return the updated note interface */
	const runUpdate = async (cb: () => Promise<any>) => {
		// Perform the update
		await cb();

		// Return the updated note interface
		const data = await firstValueFrom(streamed());
		return createWarehouseInterface(db, _id, data);
	};

	return {
		id,
		displayName,
		discountPercentage,

		createdAt,
		updatedAt,

		exists,

		async create() {
			return runUpdate(create);
		},
		async get() {
			const w = await runUpdate(() => Promise.resolve());
			return w.exists ? w : undefined;
		},
		async setDiscount(_: any, discount: number) {
			return runUpdate(() => setDiscount(discount));
		},
		async delete() {
			await db.update((db) => db.deleteFrom("warehouses").where("id", "==", id).execute());
		},
		async setName(_: any, name: string) {
			return runUpdate(() => setName(name));
		},

		getEntries() {
			return firstValueFrom(streamedEntries());
		},

		note(noteId?: string) {
			return createNoteInterface(db, id, noteId);
		},

		stream() {
			return {
				displayName: () => streamed().pipe(map(({ displayName }) => displayName)),
				discount: () => streamed().pipe(map(({ discountPercentage }) => discountPercentage)),
				entries: () => streamedEntries().pipe(map((rows) => ({ rows, total: rows.reduce((a, b) => a + b.quantity, 0) })))
			};
		}
	};
};
