import { map, Observable } from "rxjs";
import { Kysely, sql } from "crstore";

import { asc, composeCompare, debug } from "@librocco/shared";

import { EntriesStreamResult, NoteInterface, VolumeStockClient, WarehouseData, WarehouseStream } from "@/types";
import { DatabaseSchema, InventoryDatabaseInterface, WarehouseInterface } from "./types";

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

	constructor(db: InventoryDatabaseInterface, id: string | typeof NEW_WAREHOUSE) {
		this.#db = db;
		this.id = !id ? "all" : id === NEW_WAREHOUSE ? uniqueTimestamp() : id;

		// Update the instance every time there's a change in values in the db
		this._streamEntries().subscribe(this.get.bind(this));
		this._streamValues().subscribe(this.get.bind(this));
	}

	private async _getNameSeq(ctx: debug.DebugCtx): Promise<number> {
		debug.log(ctx, "[WAREHOUSE:_getNameSeq] started...")("");
		const conn = await this.#db._connection();
		debug.log(ctx, "[WAREHOUSE:_getNameSeq] got connection!")("");
		const res = await conn
			.selectFrom("warehouses as w")
			.where("w.displayName", "like", "New Warehouse%")
			.orderBy("w.displayName", "desc")
			.select("w.displayName")
			.execute();
		debug.log(ctx, "[WAREHOUSE:_getNameSeq] got res:")(res);

		const filtered = (res || [])
			.map(({ displayName }) => displayName)
			.filter((displayName) => /^New Warehouse( \([0-9]+\))?$/.test(displayName));
		debug.log(ctx, "[WAREHOUSE:_getNameSeq] filtered:")(filtered);

		// No 'New Warehouse (X)' entries (including "New Warehouse")
		if (!filtered.length) return 1;

		const match = filtered[0].match(/\([0-9]*\)/);

		// No match found - only "New Warehouse" exists
		if (!match) return 2;

		return match ? parseInt(match[0].replace(/[()]/g, "")) + 1 : 2;
	}

	private _streamValues(ctx: debug.DebugCtx = {}) {
		return this.#db
			._stream(ctx, (db) => db.selectFrom("warehouses").where("id", "==", this.id).selectAll())
			.pipe(
				map(([w]) => w),
				map((w) => {
					if (!w) return undefined;

					const { ...warehouse } = w;
					return {
						...warehouse
					};
				})
			);
	}

	private _streamEntries(ctx: debug.DebugCtx = {}): Observable<EntriesStreamResult> {
		return this.#db
			._stream(ctx, (db) => createStockQuery(db, this.id), `wh_${this.id}_entries`)
			.pipe(
				map((rows = []) => rows.map((r) => ({ __kind: "book", ...r }) as VolumeStockClient<"book">)),
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

	private async __update(data: Partial<WarehouseData>): Promise<WarehouseInterface> {
		await this.create();
		await this.#db._update((db) => db.updateTable("warehouses").set(data).where("id", "==", this.id).execute());
		return this.get();
	}

	async create(ctx: debug.DebugCtx = {}): Promise<WarehouseInterface> {
		// When creating the default pseudo-warehouse, we're not waiting for the db to be initialised,
		// as this is the part of the initalisation process itself
		debug.log(ctx, "[WAREHOUSE:create] started...")("");
		const seq = await this._getNameSeq(ctx);
		debug.log(ctx, "[WAREHOUSE:create] got seq:")(seq);
		const displayName = this.id === "all" ? "All" : seq === 1 ? "New Warehouse" : `New Warehouse (${seq})`;
		debug.log(ctx, "[WAREHOUSE:create] displayName:")(displayName);

		const createdAt = new Date().toISOString();
		const updatedAt = createdAt;
		const values = { id: this.id, displayName, discountPercentage: this.discountPercentage, createdAt, updatedAt };
		debug.log(ctx, "[WAREHOUSE:create] values:")(values);

		await this.#db._update((db) =>
			db
				.insertInto("warehouses")
				.values(values)
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
		debug.log(ctx, "[WAREHOUSE:create] done!")("");

		return this.get();
	}

	async get(): Promise<WarehouseInterface | undefined> {
		const conn = await this.#db._connection();
		const res = await conn.selectFrom("warehouses").where("id", "==", this.id).selectAll().executeTakeFirst();
		return res ? Object.assign(this, res) : undefined;
	}

	setDiscount(_: any, discountPercentage: number): Promise<WarehouseInterface> {
		return this.__update({ discountPercentage });
	}

	async delete(): Promise<void> {
		return this.#db._update((db) => db.deleteFrom("warehouses").where("id", "==", this.id).execute());
	}

	async setName(_: any, displayName: string): Promise<WarehouseInterface> {
		return this.__update({ displayName });
	}

	async getEntries(): Promise<VolumeStockClient<"book">[]> {
		const conn = await this.#db._connection();
		const rows = await createStockQuery(conn, this.id).execute();
		return rows.map((r) => ({ __kind: "book", ...r }));
	}

	note(id?: string): NoteInterface {
		return createNoteInterface(this.#db, this.id, id);
	}

	stream(): WarehouseStream {
		return {
			// TODO
			displayName: () => this._streamValues().pipe(map((w) => w?.displayName || "")),
			discount: (ctx: debug.DebugCtx = {}) =>
				this.#db
					._stream(ctx, (db) => db.selectFrom("warehouses as w").where("w.id", "==", this.id).select("w.discountPercentage"), "wh_discount")
					.pipe(map((res = []) => res[0]?.discountPercentage || 0)),
			entries: this._streamEntries.bind(this)
		};
	}
}

export const createWarehouseInterface = (db: InventoryDatabaseInterface, id?: string | typeof NEW_WAREHOUSE): WarehouseInterface =>
	new Warehouse(db, id === NEW_WAREHOUSE ? uniqueTimestamp() : id || "all");

const createStockQuery = (conn: Kysely<DatabaseSchema>, warehouseId: string) => {
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
