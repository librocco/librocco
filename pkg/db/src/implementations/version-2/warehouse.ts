import { map, of } from "rxjs";
import { sql } from "crstore";

import { NoteInterface, VolumeStockClient, WarehouseData, WarehouseStream } from "@/types";
import { InventoryDatabaseInterface, WarehouseInterface } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import { createNoteInterface } from "./note";

import { uniqueTimestamp } from "@/utils/misc";
import { observableFromStore } from "@/helpers";

class Warehouse implements WarehouseInterface {
	#db: InventoryDatabaseInterface;

	id: string;
	displayName = "";
	discountPercentage = 0;

	createdAt: string | null = null;
	updatedAt: string | null = null;

	constructor(db: InventoryDatabaseInterface, id: string) {
		this.#db = db;

		this.id = id;
	}

	private async _update(data: Partial<WarehouseData>): Promise<WarehouseInterface> {
		await this.#db._db.update((db) => db.updateTable("warehouses").set(data).where("id", "==", this.id).execute());
		return this.get();
	}

	async create(): Promise<WarehouseInterface> {
		await this.#db._db.update((db) =>
			db
				.insertInto("warehouses")
				.values({ id: this.id, displayName: this.displayName, discountPercentage: this.discountPercentage })
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
		return this.get();
	}

	async get(): Promise<WarehouseInterface | undefined> {
		const conn = await this.#db._db.connection;
		const res = await conn.selectFrom("warehouses").where("id", "==", this.id).selectAll().executeTakeFirst();
		return res ? Object.assign(this, res) : undefined;
	}

	setDiscount(_: any, discountPercentage: number): Promise<WarehouseInterface> {
		return this._update({ discountPercentage });
	}

	// TODO
	async delete(): Promise<void> {
		return;
	}

	async setName(_: any, displayName: string): Promise<WarehouseInterface> {
		return this._update({ displayName });
	}

	async getEntries(): Promise<VolumeStockClient<"book">[]> {
		const conn = await this.#db._db.connection;

		const coreQuery = conn
			.selectFrom("bookTransactions as t")
			.innerJoin("notes as n", "t.noteId", "n.id")
			.innerJoin("warehouses as w", "t.warehouseId", "w.id")
			.where("n.committed", "==", 1);

		// When querying for default pseudo-warehouse, we're retrieving all stock
		const whParametrized = this.id === "all" ? coreQuery : coreQuery.where("t.warehouseId", "==", this.id);

		const stock = whParametrized
			.select([
				"t.isbn",
				"t.warehouseId",
				"w.displayName as warehouseName",
				"w.discountPercentage as warehouseDiscount",
				(qb) => qb.fn.sum<number>(sql`CASE WHEN n.noteType == 'inbound' THEN t.quantity ELSE -t.quantity END`).as("quantity")
			])
			.groupBy(["t.warehouseId", "t.isbn"]);

		// TODO: join book data here (instead of frontend)
		const rows = await conn.selectFrom(stock.as("s")).where("s.quantity", "!=", 0).selectAll().execute();
		return rows.map((r) => ({ __kind: "book", ...r }));
	}

	note(id?: string): NoteInterface {
		return createNoteInterface(this.#db, this.id, id);
	}

	// TODO
	stream(): WarehouseStream {
		return {
			displayName: () => of(this.displayName),
			discount: () =>
				observableFromStore(
					this.#db._db.replicated((db) => db.selectFrom("warehouses as w").where("w.id", "==", this.id).select("w.discountPercentage"))
				).pipe(map((res) => res[0]?.discountPercentage || 0)),
			entries: () => of({ rows: [], total: 0 })
		};
	}
}

export const createWarehouseInterface = (db: InventoryDatabaseInterface, id?: string | typeof NEW_WAREHOUSE): WarehouseInterface =>
	new Warehouse(db, id === NEW_WAREHOUSE ? uniqueTimestamp() : id || "all");
