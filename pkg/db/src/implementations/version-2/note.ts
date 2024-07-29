import { Kysely, Schema, sql } from "crstore";
import { combineLatest, map, Observable } from "rxjs";

import { composeCompare, desc, VolumeStock, wrapIter } from "@librocco/shared";

import { EntriesStreamResult, NoteData, NoteStream, NoteType, ReceiptData, UpdateTransactionParams, VolumeStockClient } from "@/types";
import { DatabaseSchema, InventoryDatabaseInterface, NoteInterface } from "./types";

import { isBookRow, uniqueTimestamp } from "@/utils/misc";
import { observableFromStore } from "@/helpers";

class Note implements NoteInterface {
	#db: InventoryDatabaseInterface;

	id: string;
	warehouseId: string;

	noteType: NoteType;

	displayName = "";
	defaultWarehouse = "";

	committed = false;
	reconciliationNote = false;

	createdAt: string | null = null;
	updatedAt: string | null = null;
	committedAt: string | null = null;

	constructor(db: InventoryDatabaseInterface, warehouseId: string, id?: string) {
		this.#db = db;

		this.id = id || uniqueTimestamp();
		this.warehouseId = warehouseId;

		this.noteType = warehouseId === "all" ? "outbound" : "inbound";
	}

	private async _getNameSeq(): Promise<number> {
		const conn = await this.#db._db.connection;
		const res = await conn
			.selectFrom("notes as n")
			.where("n.displayName", "like", "New Note%")
			.orderBy("n.displayName", "desc")
			.select("n.displayName")
			.executeTakeFirst();

		if (!res) return 1;

		if (res.displayName === "New Note") return 2;

		return parseInt(res.displayName.match(/\([0-9]+\)/)[0].replace(/[()]/g, "")) + 1;
	}

	private async _update({ committed, reconciliationNote, ...data }: Partial<NoteData>): Promise<NoteInterface> {
		if (committed !== undefined) data["committed"] = Number(committed);
		if (reconciliationNote !== undefined) data["committed"] = Number(committed);

		// No updates to committed notes
		await this.get();
		if (this.committed) return this;

		await this.#db._db.update((db) => db.updateTable("notes").set(data).where("id", "==", this.id).execute());

		return this.get();
	}

	async create(): Promise<NoteInterface> {
		await this.#db.warehouse(this.warehouseId).create();

		const seq = await this._getNameSeq();
		const displayName = seq === 1 ? "New Note" : `New Note (${seq})`;

		await this.#db._db.update((db) =>
			db
				.insertInto("notes")
				.values({
					id: this.id,
					warehouseId: this.warehouseId,
					noteType: this.noteType,
					displayName,
					defaultWarehouse: this.defaultWarehouse
				})
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
		return this.get();
	}

	async get(): Promise<NoteInterface | undefined> {
		const conn = await this.#db._db.connection;
		const res = await conn.selectFrom("notes").where("id", "==", this.id).selectAll().executeTakeFirst();

		if (!res) return undefined;

		const { committed, reconciliationNote, ...rest } = res;
		return Object.assign(this, rest, { committed: !!committed, reconciliationNote: !!reconciliationNote });
	}

	// TODO
	async delete(): Promise<void> {
		return;
	}

	async getEntries(): Promise<VolumeStockClient[]> {
		const conn = await this.#db._db.connection;
		const books = await createBooksQuery(conn, this.id)
			.execute()
			.then((res) => res.map((b) => ({ __kind: "book", ...b } as VolumeStockClient & { updatedAt: string })));

		const customItems = await createCustomItemsQuery(conn, this.id)
			.execute()
			.then((res) => res.map((ci) => ({ __kind: "custom", ...ci } as VolumeStockClient & { updatedAt: string })));

		return (
			[...books, ...customItems]
				.sort(composeCompare(desc(({ updatedAt }) => updatedAt)))
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				.map(({ updatedAt, ...item }) => item)
		);
	}

	private _streamEntries(): Observable<EntriesStreamResult> {
		const books = observableFromStore(this.#db._db.replicated((db) => createBooksQuery(db, this.id))).pipe(
			map((b) => b.map((b) => ({ __kind: "book", ...b, availableWarehouses: new Map() } as VolumeStockClient & { updatedAt: string })))
		);
		const customItems = observableFromStore(this.#db._db.replicated((db) => createCustomItemsQuery(db, this.id))).pipe(
			map((ci) => ci.map((ci) => ({ __kind: "custom", ...ci } as VolumeStockClient & { updatedAt: string })))
		);

		return combineLatest([books, customItems]).pipe(
			map(([books, customItems]) => books.concat(customItems)),
			map((items) => ({
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				rows: items.sort(composeCompare(desc(({ updatedAt }) => updatedAt))).map(({ updatedAt, ...item }) => item),
				total: items.filter(isBookRow).reduce((acc, { quantity }) => acc + quantity, 0)
			}))
		);
	}

	async setName(_: any, displayName: string): Promise<NoteInterface> {
		return this._update({ displayName });
	}

	// TODO
	async setReconciliationNote(_: any, value: boolean): Promise<NoteInterface> {
		this.reconciliationNote = value;
		return this;
	}

	// TODO
	async setDefaultWarehouse(_: any, warehouseId: string): Promise<NoteInterface> {
		this.defaultWarehouse = warehouseId;
		return this;
	}

	async addVolumes(...volumes: VolumeStock[]): Promise<NoteInterface> {
		const [_books, _customIteme] = wrapIter(volumes)
			.enumerate()
			.partition((tup): tup is [number, VolumeStockClient<"book">] => isBookRow(tup[1]));
		const books = _books
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			.map(([i, { __kind, warehouseId, ...txn }]) => ({
				...txn,
				noteId: this.id,
				warehouseId: this.noteType === "inbound" ? this.warehouseId : warehouseId || "",
				// We add 1 millisecond to each transaction to ensure unique updatedAt values
				updatedAt: new Date(Date.now() + i).toISOString()
			}))
			.array();
		const customItems = _customIteme
			.map((tup) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const [i, { __kind, id, price, title }] = tup as [number, VolumeStockClient<"custom">];
				return {
					id: id || uniqueTimestamp(),
					title,
					price,
					noteId: this.id,
					// We add 1 millisecond to each transaction to ensure unique updatedAt values
					updatedAt: new Date(Date.now() + i).toISOString()
				};
			})
			.array();

		await Promise.all([
			!books.length
				? Promise.resolve()
				: this.#db._db.update((db) =>
						db
							.insertInto("bookTransactions")
							.values(books)
							.onConflict((oc) =>
								oc.doUpdateSet((eb) => ({
									quantity: sql`${eb.ref("quantity")} + ${eb.ref("excluded.quantity")}`,
									updatedAt: eb.ref("excluded.updatedAt")
								}))
							)
							.execute()
				  ),
			!customItems.length
				? Promise.resolve()
				: this.#db._db.update((db) =>
						db
							.insertInto("customItemTransactions")
							.values(customItems)
							.onConflict((oc) => oc.doNothing())
							.execute()
				  )
		]);

		return this;
	}

	async updateTransaction(_: any, ...params: UpdateTransactionParams<"book"> | UpdateTransactionParams<"custom">) {
		if (typeof params[0] === "string") {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [id, { __kind, ...update }] = params as UpdateTransactionParams<"custom">;
			await this.#db._db.update((db) =>
				db.updateTable("customItemTransactions").where("noteId", "==", this.id).where("id", "==", id).set(update).execute()
			);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [{ __kind: _0, ...match }, { __kind: _1, ...update }] = params as UpdateTransactionParams<"book">;
			const matchIsbn = match.isbn;
			const matchWarehouseId = match.warehouseId || (this.noteType === "inbound" ? this.warehouseId : "");

			// Get the existing txn - this serves as both a check that it exists, and to get the updatedAt value
			// The updatedAt value is used to keep order as it was (for FE UX), unless two rows are merged - in which case the result gets bubbled up
			const existing = await this.#db._db.connection.then((conn) =>
				conn
					.selectFrom("bookTransactions as t")
					.where("t.noteId", "==", this.id)
					.where("t.isbn", "==", matchIsbn)
					.where("t.warehouseId", "==", matchWarehouseId)
					.select("updatedAt")
					.executeTakeFirst()
			);

			// If txn is not matched - noop
			if (!existing) return this;

			// We're removing the matched transaction first, as changing the warehouseId might result in aggregation
			// with the existing (isbn/warehouseId) entry - in which case the quantities are aggregated
			await this.#db._db.update((db) =>
				db
					.deleteFrom("bookTransactions")
					.where("noteId", "==", this.id)
					.where("isbn", "==", matchIsbn)
					.where("warehouseId", "==", matchWarehouseId)
					.execute()
			);

			// After removing the match txn, we're adding a new one, so that we can automatically aggregate
			// quantity if there already exists a transaction with the same isbn and warehouseId
			await this.#db._db.update((db) =>
				db
					.insertInto("bookTransactions")
					.values({ ...match, ...update, noteId: this.id, updatedAt: existing.updatedAt })
					.onConflict((oc) =>
						oc.doUpdateSet((eb) => ({
							quantity: sql`${eb.ref("quantity")} + ${eb.ref("excluded.quantity")}`,
							updatedAt: new Date().toISOString()
						}))
					)
					.execute()
			);
		}

		return this;
	}

	// TODO
	async removeTransactions(): Promise<NoteInterface> {
		return this;
	}

	commit(): Promise<NoteInterface> {
		const updatedAt = new Date().toISOString();
		const committedAt = updatedAt;

		return this._update({ committed: true, updatedAt, committedAt });
	}

	// TODO
	async intoReceipt(): Promise<ReceiptData> {
		return { timestamp: Date.now(), items: [] };
	}

	// TODO
	async reconcile(): Promise<NoteInterface> {
		return this;
	}

	stream(): NoteStream {
		return {
			entries: this._streamEntries.bind(this)
		} as NoteStream;
	}
}

export const createNoteInterface = (db: InventoryDatabaseInterface, warehouseId: string, id?: string): NoteInterface =>
	new Note(db, warehouseId, id);

// #region utils
const createBooksQuery = (conn: Kysely<Schema<DatabaseSchema>>, noteId: string) =>
	conn
		.selectFrom("bookTransactions as t")
		.leftJoin("warehouses as w", "t.warehouseId", "w.id")
		.where("t.noteId", "==", noteId)
		.select([
			"t.isbn",
			"t.quantity",
			"t.warehouseId",
			(qb) => qb.fn.coalesce(qb.ref("w.discountPercentage"), qb.val(0)).as("warehouseDiscount"),
			(qb) => qb.fn.coalesce(qb.ref("w.displayName"), qb.val("not-found")).as("warehouseName"),
			"t.updatedAt"
		]);

const createCustomItemsQuery = (conn: Kysely<Schema<DatabaseSchema>>, noteId: string) =>
	conn
		.selectFrom("customItemTransactions as t")
		.where("t.noteId", "==", noteId)
		.orderBy("t.updatedAt", "desc")
		.select(["id", "title", "price", "t.updatedAt"]);
