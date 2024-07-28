import { of } from "rxjs";

import { NoteInterface, VolumeStockClient, WarehouseStream } from "@/types";
import { InventoryDatabaseInterface, WarehouseInterface } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import { createNoteInterface } from "./note";

import { uniqueTimestamp } from "@/utils/misc";

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

	// TODO
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
		const [res] = await conn.selectFrom("warehouses").where("id", "==", this.id).selectAll().execute();
		return res ? Object.assign(this, res) : undefined;
	}

	// TODO
	async setDiscount(): Promise<WarehouseInterface> {
		return this;
	}

	// TODO
	async delete(): Promise<void> {
		return;
	}

	// TODO
	async setName(): Promise<WarehouseInterface> {
		return this;
	}

	// TODO
	async getEntries(): Promise<VolumeStockClient<"book">[]> {
		return [];
	}

	note(id?: string): NoteInterface {
		return createNoteInterface(this.#db, this.id, id);
	}

	// TODO
	stream(): WarehouseStream {
		return {
			displayName: () => of(this.displayName),
			discount: () => of(this.discountPercentage),
			entries: () => of({ rows: [], total: 0 })
		};
	}
}

export const createWarehouseInterface = (db: InventoryDatabaseInterface, id?: string | typeof NEW_WAREHOUSE): WarehouseInterface =>
	new Warehouse(db, id === NEW_WAREHOUSE ? uniqueTimestamp() : id || "all");
