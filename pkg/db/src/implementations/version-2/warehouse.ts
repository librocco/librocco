import { map, Observable, of } from "rxjs";
import { Kysely, Schema, sql } from "crstore";

import { asc, composeCompare } from "@librocco/shared";

import { EntriesStreamResult, NoteInterface, VolumeStockClient, WarehouseData, WarehouseStream } from "@/types";
import { DatabaseSchema, InventoryDatabaseInterface, WarehouseInterface } from "./types";

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

		// Update the instance every time there's a change in values in the db
		this._streamEntries().subscribe(this.get.bind(this));
	}

	private async _getNameSeq(): Promise<number> {
		const conn = await this.#db._db.connection;
		const res = await conn
			.selectFrom("warehouses as w")
			.where("w.displayName", "like", "New Warehouse%")
			.orderBy("w.displayName", "desc")
			.select("w.displayName")
			.execute();

		const filtered = res.map(({ displayName }) => displayName).filter((displayName) => /^New Warehouse( \([0-9]+\))?$/.test(displayName));

		// No 'New Warehouse (X)' entries (including "New Warehouse")
		if (!filtered.length) return 1;

		const match = filtered[0].match(/\([0-9]*\)/);

		// No match found - only "New Warehouse" exists
		if (!match) return 2;

		return match ? parseInt(match[0].replace(/[()]/g, "")) + 1 : 2;
	}

	private _streamEntries(): Observable<EntriesStreamResult> {
		return observableFromStore(this.#db._db.replicated((db) => createStockQuery(db, this.id))).pipe(
			map((rows) => rows.map((r) => ({ __kind: "book", ...r } as VolumeStockClient<"book">))),
			map((rows) =>
				rows.sort(
					composeCompare(
						asc((r) => r.isbn),
						asc((r) => r.warehouseId)
					)
				)
			),
			map((rows) => ({ rows, total: rows.length }))
		);
	}

	private async _update(data: Partial<WarehouseData>): Promise<WarehouseInterface> {
		await this.create();
		await this.#db._db.update((db) => db.updateTable("warehouses").set(data).where("id", "==", this.id).execute());
		return this.get();
	}

	async create(): Promise<WarehouseInterface> {
		const seq = await this._getNameSeq();
		const displayName = this.id === "all" ? "All" : seq === 1 ? "New Warehouse" : `New Warehouse (${seq})`;

		await this.#db._db.update((db) =>
			db
				.insertInto("warehouses")
				.values({ id: this.id, displayName, discountPercentage: this.discountPercentage })
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
		const rows = await createStockQuery(conn, this.id).execute();
		return rows.map((r) => ({ __kind: "book", ...r }));
	}

	note(id?: string): NoteInterface {
		return createNoteInterface(this.#db, this.id, id);
	}

	stream(): WarehouseStream {
		return {
			displayName: () => of(this.displayName),
			discount: () =>
				observableFromStore(
					this.#db._db.replicated((db) => db.selectFrom("warehouses as w").where("w.id", "==", this.id).select("w.discountPercentage"))
				).pipe(map((res) => res[0]?.discountPercentage || 0)),
			entries: this._streamEntries.bind(this)
		};
	}
}

export const createWarehouseInterface = (db: InventoryDatabaseInterface, id?: string | typeof NEW_WAREHOUSE): WarehouseInterface =>
	new Warehouse(db, id === NEW_WAREHOUSE ? uniqueTimestamp() : id || "all");

const createStockQuery = (conn: Kysely<Schema<DatabaseSchema>>, warehouseId: string) => {
	const coreQuery = conn
		.selectFrom("bookTransactions as t")
		.innerJoin("notes as n", "t.noteId", "n.id")
		.innerJoin("warehouses as w", "t.warehouseId", "w.id")
		.where("n.committed", "==", 1);

	// When querying for default pseudo-warehouse, we're retrieving all stock
	const whParametrized = warehouseId === "all" ? coreQuery : coreQuery.where("t.warehouseId", "==", warehouseId);

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
	return conn.selectFrom(stock.as("s")).where("s.quantity", "!=", 0).selectAll();
};
