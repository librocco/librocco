import { Kysely, sql } from "crstore";
import { combineLatest, firstValueFrom, map, Observable, switchMap, tap } from "rxjs";

import { asc, composeCompare, desc, NoteState, VolumeStock, VolumeStockKind, wrapIter, debug } from "@librocco/shared";

import {
	EntriesStreamResult,
	NavMap,
	NoteStream,
	NoteType,
	OutOfStockTransaction,
	ReceiptData,
	UpdateTransactionParams,
	VolumeStockClient
} from "@/types";
import { DatabaseSchema, InventoryDatabaseInterface, NoteInterface } from "./types";

import { isBookRow, uniqueTimestamp } from "@/utils/misc";

import { EmptyNoteError, NoWarehouseSelectedError, OutOfStockError } from "@/errors";

type TimestampedVolumeStockClient<K extends VolumeStockKind = VolumeStockKind> = VolumeStockClient<K> & { updatedAt: string };

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

		// Update the instance every time there's a change in values in the db
		this._streamEntries().subscribe(this.get.bind(this));
	}

	private async _getNameSeq(): Promise<number> {
		const conn = await this.#db._connection();
		const res = await conn
			.selectFrom("notes as n")
			.where("n.deleted", "!=", 1)
			.where("n.displayName", "like", "New Note%")
			.orderBy("n.displayName", "desc")
			.selectAll()
			.execute();

		const filtered = res.map(({ displayName }) => displayName).filter((displayName) => /^New Note( \([0-9]+\))?$/.test(displayName));

		// No 'New Note (X)' entries (including "New Note")
		if (!filtered.length) return 1;

		const match = filtered[0].match(/\([0-9]*\)/);

		// No match found - only "New Note" exists
		if (!match) return 2;

		return match ? parseInt(match[0].replace(/[()]/g, "")) + 1 : 2;
	}

	/** Used to check for book availability across warehouses */
	private _streamExistingStock(ctx: debug.DebugCtx, isbns: string[]): Observable<Map<string, NavMap<{ quantity: number }>>> {
		const store = this.#db._stream(ctx, (db) => createExistingStockQuery(db, isbns), `n_${this.id}_existing_stock`);

		return store.pipe(
			tap(debug.log(ctx, "note:stream:existing_stock:input")),
			map(createExistingStockMap),
			tap(debug.log(ctx, "note:stream:existing_stock:res"))
		);
	}

	private async _getExistingStock(isbns: string[]): Promise<Map<string, NavMap<{ quantity: number }>>> {
		const conn = await this.#db._connection();
		return createExistingStockQuery(conn, isbns).execute().then(createExistingStockMap);
	}

	private async _update({ committed, reconciliationNote, ...data }: Partial<DatabaseSchema["notes"]>): Promise<NoteInterface> {
		await this.create();

		if (committed !== undefined) data["committed"] = Number(committed);
		if (reconciliationNote !== undefined) data["committed"] = Number(committed);

		// No updates to committed notes
		await this.get();
		if (this.committed) return this;

		await this.#db._update((db) => db.updateTable("notes").set(data).where("id", "==", this.id).execute());

		return this.get();
	}

	/**
	 * Checks that all transactions have a warehouse assigned to them.
	 * @returns a list of all invalid transactions in that regard.
	 */
	private _getNoWarehouseTransactions(entries: VolumeStock[]): VolumeStock<"book">[] {
		return entries
			.filter(isBookRow)
			.filter(({ warehouseId }) => !warehouseId)
			.sort(
				composeCompare(
					asc(({ isbn }) => isbn),
					asc(({ warehouseId }) => warehouseId)
				)
			);
	}

	private async _getOutOfStockTransactions(_entries: VolumeStockClient[]): Promise<OutOfStockTransaction[]> {
		const entries = _entries.filter(isBookRow);
		const stock = await this._getExistingStock(entries.map(({ isbn }) => isbn));
		const warehouseMap = await firstValueFrom(this.#db.stream().warehouseMap({}));
		return (
			entries
				.map(({ isbn, quantity, warehouseId }) => ({
					isbn,
					quantity,
					warehouseId,
					available: stock.get(isbn)?.get(warehouseId)?.quantity || 0,
					warehouseName: warehouseMap.get(warehouseId)?.displayName || "unkonwn"
				}))
				// Filter out transactions that are valid
				.filter(({ quantity, available }) => quantity > available)
				.sort(
					composeCompare(
						asc(({ isbn }) => isbn),
						asc(({ warehouseId }) => warehouseId)
					)
				)
		);
	}

	async create(): Promise<NoteInterface> {
		await this.#db.warehouse(this.warehouseId).create();

		const seq = await this._getNameSeq();
		const displayName = seq === 1 ? "New Note" : `New Note (${seq})`;

		const createdAt = new Date().toISOString();
		const updatedAt = createdAt;

		await this.#db._update((db) =>
			db
				.insertInto("notes")
				.values({
					id: this.id,
					warehouseId: this.warehouseId,
					noteType: this.noteType,
					displayName,
					defaultWarehouse: this.defaultWarehouse,

					committed: 0,
					deleted: 0,
					reconciliationNote: 0,

					createdAt,
					updatedAt,
					committedAt: null
				})
				.onConflict((oc) => oc.doNothing())
				.execute()
		);
		return this.get();
	}

	async get(): Promise<NoteInterface | undefined> {
		const conn = await this.#db._connection();
		const res = await conn.selectFrom("notes").where("id", "==", this.id).selectAll().executeTakeFirst();

		if (!res) return undefined;

		const { committed, reconciliationNote, ...rest } = res;
		return Object.assign(this, rest, { committed: !!committed, reconciliationNote: !!reconciliationNote });
	}

	async delete(): Promise<void> {
		await this._update({ deleted: 1 });
	}

	async getEntries(): Promise<VolumeStockClient[]> {
		const conn = await this.#db._connection();
		const books = await createBooksQuery(conn, this.id)
			.execute()
			.then((res) => res.map((b) => ({ __kind: "book", ...b } as TimestampedVolumeStockClient)));

		const customItems = await createCustomItemsQuery(conn, this.id)
			.execute()
			.then((res) => res.map((ci) => ({ __kind: "custom", ...ci } as TimestampedVolumeStockClient)));

		return (
			[...books, ...customItems]
				.sort(composeCompare(desc(({ updatedAt }) => updatedAt)))
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				.map(({ updatedAt, ...item }) => item)
		);
	}

	private _streamValues(ctx: debug.DebugCtx = {}) {
		return this.#db
			._stream(ctx, (db) => db.selectFrom("notes").where("id", "==", this.id).selectAll())
			.pipe(
				map(([n]) => n),
				map((n) => {
					if (!n) return undefined;

					const { committed, reconciliationNote, noteType, ...note } = n;
					return {
						...note,
						committed: !!committed,
						reconciliationNote: !!reconciliationNote,
						noteType: noteType as NoteType,
						deleted: !!note.deleted
					};
				})
			);
	}

	private _streamEntries(ctx: debug.DebugCtx = {}): Observable<EntriesStreamResult> {
		// const constructBookEntry = (b: VolumeStockClient<"book">) =>
		const mergeWarehouseAvailability = (obs: Observable<TimestampedVolumeStockClient<"book">[]>) =>
			this.noteType === "inbound"
				? obs
				: obs.pipe(
						switchMap((books) => {
							const isbns = books.map((b) => b.isbn);
							return this._streamExistingStock(ctx, isbns).pipe(
								map((availability) =>
									books.map((b) => ({ ...b, availableWarehouses: availability.get(b.isbn) || new Map() } as TimestampedVolumeStockClient))
								)
							);
						})
				  );

		const books = this.#db
			._stream(ctx, (db) => createBooksQuery(db, this.id), `n_${this.id}_entries_books`)
			.pipe(
				tap(debug.log(ctx, "note:stream:entries:books")),
				map((b = []) => b.map((b) => ({ __kind: "book", ...b } as TimestampedVolumeStockClient<"book">))),
				mergeWarehouseAvailability,
				tap(debug.log(ctx, "note:stream:entries:books:res"))
			);
		const customItems = this.#db
			._stream(ctx, (db) => createCustomItemsQuery(db, this.id), `n_${this.id}_entries_custom`)
			.pipe(
				tap(debug.log(ctx, "note:stream:entries:customItems")),
				map((ci = []) => ci.map((ci) => ({ __kind: "custom", ...ci } as VolumeStockClient & { updatedAt: string }))),
				tap(debug.log(ctx, "note:stream:entries:customItems:res"))
			);

		return combineLatest([books, customItems]).pipe(
			map(([books, customItems]) => ({
				rows: books
					.concat(customItems)
					.sort(composeCompare(desc(({ updatedAt }) => updatedAt)))
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					.map(({ updatedAt, ...item }) => item),
				total: books.length
			})),
			tap(debug.log(ctx, "note:stream:entries:res"))
		);
	}

	async setName(_: any, displayName: string): Promise<NoteInterface> {
		return this._update({ displayName });
	}

	async setReconciliationNote(_: any, value: boolean): Promise<NoteInterface> {
		return this._update({ reconciliationNote: value ? 1 : 0 });
	}

	async setDefaultWarehouse(_: any, defaultWarehouse: string): Promise<NoteInterface> {
		return this._update({ defaultWarehouse });
	}

	async addVolumes(_: debug.DebugCtx, ...volumes: VolumeStock[]): Promise<NoteInterface> {
		await this.create();
		const [_books, _customItems] = wrapIter(volumes)
			.enumerate()
			.partition((tup): tup is [number, VolumeStockClient<"book">] => isBookRow(tup[1]));
		const books = _books
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			.map(([i, { __kind, isbn, warehouseId, quantity }]) => ({
				isbn,
				noteId: this.id,
				warehouseId: this.noteType === "inbound" ? this.warehouseId : warehouseId || this.defaultWarehouse || "",
				quantity,
				// We add 1 millisecond to each transaction to ensure unique updatedAt values
				updatedAt: new Date(Date.now() + i).toISOString()
			}))
			.array();
		const customItems = _customItems
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
				: this.#db._update((db) =>
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
				: this.#db._update((db) =>
						db
							.insertInto("customItemTransactions")
							.values(customItems)
							.onConflict((oc) => oc.doNothing())
							.execute()
				  )
		]);

		return this.get();
	}

	async updateTransaction(_: any, ...params: UpdateTransactionParams<"book"> | UpdateTransactionParams<"custom">) {
		if (typeof params[0] === "string") {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [id, { __kind, ...update }] = params as UpdateTransactionParams<"custom">;
			await this.#db._update((db) =>
				db.updateTable("customItemTransactions").where("noteId", "==", this.id).where("id", "==", id).set(update).execute()
			);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [{ __kind: _0, ...match }, { __kind: _1, ...update }] = params as UpdateTransactionParams<"book">;
			const matchIsbn = match.isbn;
			const matchWarehouseId = match.warehouseId || (this.noteType === "inbound" ? this.warehouseId : "");

			// Get the existing txn - this serves as both a check that it exists, and to get the updatedAt value
			// The updatedAt value is used to keep order as it was (for FE UX), unless two rows are merged - in which case the result gets bubbled up
			const existing = await this.#db
				._connection()
				.then((conn) =>
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
			await this.#db._update((db) =>
				db
					.deleteFrom("bookTransactions")
					.where("noteId", "==", this.id)
					.where("isbn", "==", matchIsbn)
					.where("warehouseId", "==", matchWarehouseId)
					.execute()
			);

			// After removing the match txn, we're adding a new one, so that we can automatically aggregate
			// quantity if there already exists a transaction with the same isbn and warehouseId
			await this.#db._update((db) =>
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

	async removeTransactions(_: debug.DebugCtx, ...transactions: Array<VolumeStock<"custom">["id"] | Omit<VolumeStock<"book">, "quantity">>) {
		const [_books, _customItems] = wrapIter(transactions).partition((t) => typeof t !== "string");

		const books = _books.array();

		const customItems = _customItems.array();

		await Promise.all([
			books.map(({ isbn, warehouseId }) =>
				this.#db._update((db) =>
					db
						.deleteFrom("bookTransactions")
						.where("noteId", "==", this.id)
						.where("isbn", "==", isbn)
						.where("warehouseId", "==", warehouseId)
						.execute()
				)
			),
			!customItems.length
				? Promise.resolve()
				: this.#db._update((db) =>
						db.deleteFrom("customItemTransactions").where("noteId", "==", this.id).where("id", "in", customItems).execute()
				  )
		]);

		return this;
	}

	async commit(_: any, options: { force?: boolean } = {}): Promise<NoteInterface> {
		const entries = await this.getEntries();

		// Don't allow for committing of empty notes.
		// We're allowing commit if 'force === true' (this should only be used in tests)
		if (entries.length === 0 && !options?.force) {
			throw new EmptyNoteError();
		}

		// Check transactions before committing
		if (this.noteType === "outbound") {
			// Check for transactions without a warehouse assigned - outbound note can't be committed in this state
			const invalidTransactions = this._getNoWarehouseTransactions(entries);
			if (invalidTransactions.length) {
				throw new NoWarehouseSelectedError(invalidTransactions);
			}

			// Check for out-of-stock transactions - outbound note can't be committed in this state, but the state can be reconciled
			const outOfStockTransactions = await this._getOutOfStockTransactions(entries);
			if (outOfStockTransactions.length) {
				throw new OutOfStockError(outOfStockTransactions);
			}
		}

		const updatedAt = new Date().toISOString();
		const committedAt = updatedAt;

		return this._update({ committed: 1, updatedAt, committedAt });
	}

	async reconcile(ctx: debug.DebugCtx): Promise<NoteInterface> {
		// Only outbound note can be reconciled
		const inbound = this.noteType === "inbound";
		// Committed notes don't need reconciliation
		const committed = this.committed;
		if (inbound || committed) {
			debug.log(ctx, "note:reconcile:noop")({ noteType: this.noteType, committed });
			return this;
		}

		const entries = await this.getEntries().then((rows) => rows.filter(isBookRow));
		const stock = await this._getExistingStock(entries.map(({ isbn }) => isbn));

		const getQuantity = (isbn: string, warehouseId: string) => stock.get(isbn)?.get(warehouseId)?.quantity || 0;

		const toUpdate = wrapIter(entries)
			// Custom items are irrelevant for this action
			.filter(isBookRow)
			// Filter out rows with no 'warehouseId' assigned - those aren't ready
			// for reconciliation and should be handled somewhere else
			.filter(({ warehouseId }) => Boolean(warehouseId))
			// Check the difference in quantity available and quantity demanded
			.map(({ isbn, warehouseId, quantity }) => ({ warehouseId, isbn, diff: getQuantity(isbn, warehouseId) - quantity }))
			// Filter out rows that don't need to be reconciled - they are fully in stock for desired warehouse/quantity
			.filter(({ diff }) => diff < 0)
			// Prepare the rows for reconciliation notes - make the quantity positive
			.map(({ diff, ...txn }) => ({ ...txn, quantity: -diff }))
			// Group remaining rows by warehouse
			.reduce((acc, txn) => {
				const whId = txn.warehouseId;
				const existing = acc.get(whId) || [];
				return acc.set(whId, [...existing, txn]);
			}, new Map<string, VolumeStock[]>());

		// Create a reconciliation note for each warehouse
		const updates = wrapIter(toUpdate).map(([whId, transactions]) =>
			this.#db
				.warehouse(whId)
				.note()
				.create()
				.then((n) => n.setReconciliationNote(ctx, true))
				.then((n) => n.addVolumes({}, ...transactions))
				.then((n) => n.commit(ctx))
		);
		await Promise.all(updates);

		return this;
	}

	async intoReceipt(): Promise<ReceiptData> {
		const conn = await this.#db._connection();

		const books = conn
			.selectFrom(createBooksQuery(conn, this.id).as("e"))
			.leftJoin("books as b", "e.isbn", "b.isbn")
			.select(["e.isbn", "b.title", "e.quantity", "b.price", "e.warehouseDiscount as discount"])
			.execute();
		const customItems = conn
			.selectFrom(createCustomItemsQuery(conn, this.id).as("e"))
			.select(["e.title", "e.price", "e.id", "e.updatedAt"])
			.execute()
			.then((res) =>
				res
					.sort(asc(({ updatedAt }) => updatedAt))
					.map(({ id, title, price }) => ({ __kind: "custom", id, title, price, quantity: 1, discount: 0 }))
			);

		const items = await Promise.all([books, customItems]).then(([books, customItems]) => [...books, ...customItems]);

		return { timestamp: Date.now(), items };
	}

	stream(): NoteStream {
		return {
			entries: this._streamEntries.bind(this),
			displayName: () => this._streamValues().pipe(map((n) => n?.displayName || "")),
			defaultWarehouseId: () => this._streamValues().pipe(map(({ defaultWarehouse }) => defaultWarehouse)),
			state: () =>
				this._streamValues().pipe(map((n) => (n?.deleted ? NoteState.Deleted : n?.committed ? NoteState.Committed : NoteState.Draft))),
			updatedAt: () => this._streamValues().pipe(map((n) => (n?.updatedAt ? new Date(n?.updatedAt) : null)))
		} as NoteStream;
	}
}

export const createNoteInterface = (db: InventoryDatabaseInterface, warehouseId: string, id?: string): NoteInterface =>
	new Note(db, warehouseId, id);

// #region utils
const createBooksQuery = (conn: Kysely<DatabaseSchema>, noteId: string) =>
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

const createCustomItemsQuery = (conn: Kysely<DatabaseSchema>, noteId: string) =>
	conn
		.selectFrom("customItemTransactions as t")
		.where("t.noteId", "==", noteId)
		.orderBy("t.updatedAt", "desc")
		.select(["id", "title", "price", "t.updatedAt"]);

const createExistingStockQuery = (conn: Kysely<DatabaseSchema>, isbns: string[]) => {
	const stock = conn
		.selectFrom("bookTransactions as t")
		.innerJoin("notes as n", "t.noteId", "n.id")
		.innerJoin("warehouses as w", "t.warehouseId", "w.id")
		.where("n.committed", "==", 1)
		.where("t.isbn", "in", isbns)
		.select([
			"t.isbn",
			"t.warehouseId",
			"w.displayName as displayName",
			(qb) => qb.fn.sum<number>(sql`CASE WHEN n.noteType == 'inbound' THEN t.quantity ELSE -t.quantity END`).as("quantity")
		])
		.groupBy(["t.warehouseId", "t.isbn"]);

	return conn.selectFrom(stock.as("s")).where("s.quantity", ">", 0).selectAll();
};

const createExistingStockMap = (rows: { isbn: string; warehouseId: string; quantity: number; displayName: string }[]) => {
	const mapGenerator = wrapIter(rows)
		// Group by isbn: { isbn => Iterable { warehouseId => data } }
		._group(({ isbn, warehouseId, quantity, displayName }) => [isbn, [warehouseId, { quantity, displayName }] as const])
		// Convert each internal iterable into a map: Iterable { warehouseId => data } -> Map { warehouseId => data }
		.map(([isbn, warehouses]) => [isbn, new Map(warehouses)] as const);
	return new Map(mapGenerator);
};
