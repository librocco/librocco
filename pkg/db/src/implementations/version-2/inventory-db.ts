/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ss from "superstruct";
import { combineLatest, firstValueFrom, map, Observable, of } from "rxjs";
import { crr, groupJSON, primary, Schema, sql } from "crstore";
import { database, type SvelteDatabase } from "crstore/svelte";

import {
	BooksInterface,
	Replicator,
	WarehouseDataMap,
	HistoryInterface,
	InventoryDatabaseInterface as IDB,
	WarehouseInterface,
	NoteInterface,
	BookEntry,
	VolumeStockClient,
	NoteType,
	WarehouseData,
	ReceiptItem,
	UpdateTransactionParams,
	NoteStream,
	NoteLookupResult,
	PastTransaction,
	PluginInterfaceLookup,
	LibroccoPlugin,
	InventoryDatabaseConstructor
} from "@/index";
import { NoteState, StockMap, VolumeStock, wrapIter } from "@librocco/shared";
import { observableFromStore } from "@/helpers";
import { NEW_WAREHOUSE } from "@/constants";
import { isBookRow, uniqueTimestamp } from "@/utils/misc";
import { get } from "svelte/store";
import { newPluginsInterface } from "./plugins";

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
			committed: ss.boolean(),

			displayName: ss.string(),
			defaultWarehouse: ss.optional(ss.string()),
			reconciliationNote: ss.boolean(),

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
			quantity: ss.number()
		}),
		"isbn",
		"noteId"
	)
);

const customItemTransactionSchema = crr(
	primary(
		ss.object({
			noteId: ss.string(),

			id: ss.string(),
			title: ss.string(),
			price: ss.number()
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
			outOfPrint: ss.optional(ss.boolean()),
			category: ss.optional(ss.string()),
			updatedAt: ss.optional(ss.string())
		}),
		"isbn"
	)
);

const schema = ss.object({
	warehouses: warehouseSchema,
	notes: noteSchema,
	bookTransactions: bookTransctionSchema,
	customItemTransactions: customItemTransactionSchema,
	books: bookDataSchema
});

type S = typeof schema;
type InventoryDatabaseInterface = IDB & SvelteDatabase<Schema<S>>;

export const createDB = (schema: S, name: string): InventoryDatabaseInterface => {
	const db = database(schema, { name });

	const warehouses = () => db.replicated((db) => db.selectFrom("warehouses").selectAll());
	const warehouseMap = (): Observable<WarehouseDataMap> =>
		observableFromStore(warehouses()).pipe(
			map((whs) => new Map(whs.map(({ id, displayName, discountPercentage }) => [id, { displayName, discountPercentage }])))
		);

	const inNotes = () =>
		db.replicated((db) =>
			db
				.selectFrom("warehouses as w")
				.rightJoin("notes as n", "w.id", "n.warehouseId")
				.where("n.noteType", "==", "inbound")
				.where("n.committed", "==", false)
				.select([
					"w.id",
					"w.displayName",
					(gq) =>
						groupJSON(gq, {
							id: "n.id",
							displayName: "n.displayName",
							updatedAt: "n.updatedAt"
						}).as("notes")
				])
				.groupBy("w.id")
		);
	const inNoteList = () =>
		observableFromStore(inNotes()).pipe(
			map(
				(entries) =>
					new Map(
						entries.map(({ id, displayName, notes }) => [
							id!,
							{ id: id!, displayName: displayName!, notes: new Map(notes.map(({ id, displayName }) => [id!, { id, displayName }])) }
						])
					)
			)
		);

	const outNotes = () =>
		db.replicated((db) => db.selectFrom("notes").where("noteType", "==", "outbound").where("committed", "==", false).selectAll());
	const outNoteList = () =>
		observableFromStore(outNotes()).pipe(map((notes) => new Map(notes.map(({ id, displayName }) => [id, { id, displayName }]))));

	// TODO: this should be unnecessary
	const stock = () => of(new StockMap());

	const findNote = (id: string): NoteLookupResult<NoteInterface, WarehouseInterface> | undefined => {
		const note = get(db.replicated((db) => db.selectFrom("notes").where("id", "==", id).select(["warehouseId"])))[0];
		if (!note) return undefined;
		return {
			note: createNoteInterface(createDB(schema, name), note.warehouseId, id),
			warehouse: createWarehouseInterface(createDB(schema, name), note.warehouseId)
		};
	};

	const plugins = newPluginsInterface();

	return Object.assign(db, {
		books() {
			return createBooksInterface(createDB(schema, name));
		},
		warehouse(id?: string | typeof NEW_WAREHOUSE) {
			return createWarehouseInterface(createDB(schema, name), id);
		},

		stream() {
			return { warehouseMap, inNoteList, outNoteList, stock };
		},

		async init() {
			return createDB(schema, name);
		},

		destroy() {
			// TODO
			return Promise.resolve();
		},

		buildIndices() {
			return Promise.resolve();
		},

		findNote(id: string) {
			return Promise.resolve(findNote(id));
		},

		getWarehouseDataMap() {
			return firstValueFrom(warehouseMap());
		},

		history() {
			return createHistoryInterface(createDB(schema, name));
		},

		plugin<T extends keyof PluginInterfaceLookup>(type: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
			return plugins.get(type);
		},

		// TODO
		replicate() {
			return {} as Replicator;
		},

		// TODO shouldn't be part of public api
		updateDesignDoc() {
			return Promise.resolve() as any;
		}
	});
};

const createBooksInterface = (db: InventoryDatabaseInterface): BooksInterface => {
	const streamed = (isbns: string[]) =>
		observableFromStore(db.replicated((db) => db.selectFrom("books").where("isbn", "in", isbns).selectAll()));

	const publishers = () =>
		db.replicated((db) =>
			db.selectFrom("books").distinctOn("publisher").select("publisher").where("publisher", "!=", "").where("publisher", "!=", null)
		);

	const upsert = async (books: Partial<BookEntry>[]) => {
		const values = books.filter((b): b is BookEntry => !!b.isbn).map((book) => ({ ...book, updatedAt: new Date().toISOString() }));
		await db.update((db) =>
			db
				.insertInto("books")
				.values(values)
				.onConflict((oc) =>
					oc.column("isbn").doUpdateSet((du) => {
						// Update only the specified fields on conflict
						return Object.fromEntries(
							[
								["isbn", du.ref("excluded.isbn")],
								["authors", du.ref("excluded.authors")],
								["category", du.ref("excluded.category")],
								["editedBy", du.ref("excluded.editedBy")],
								["outOfPrint", du.ref("excluded.outOfPrint")],
								["price", du.ref("excluded.price")],
								["publisher", du.ref("excluded.publisher")],
								["title", du.ref("excluded.title")],
								["updatedAt", du.ref("excluded.updatedAt")],
								["year", du.ref("excluded.year")]
							].filter(([, ref]) => ref !== undefined && ref !== null)
						);
					})
				)
				.execute()
		);
	};

	return {
		get: (isbns: string[]) => firstValueFrom(streamed(isbns)),
		stream: (_, isbns) => streamed(isbns),
		// Publishers will always be non empty strings (validated at query level)
		streamPublishers: () => observableFromStore(publishers()).pipe(map((p) => p.map(({ publisher }) => publisher as string))),
		upsert,
		// TODO
		streamSearchIndex: () => new Observable()
	};
};

const createWarehouseInterface = (
	db: InventoryDatabaseInterface,
	_id?: string | typeof NEW_WAREHOUSE,
	data?: Partial<WarehouseData>
): WarehouseInterface => {
	const id: any = _id === NEW_WAREHOUSE ? uniqueTimestamp() : _id || "all";

	const createdAt: string | null = null;
	const updatedAt: string | null = null;

	let { displayName = "", discountPercentage = 0 } = data || {};

	// TODO: rewrite this as a single query
	const streamed = () => observableFromStore(db.replicated((db) => db.selectFrom("warehouses as w").selectAll())).pipe(map(([w]) => w));
	streamed().subscribe(({ displayName: _displayName, discountPercentage: _discountPercentage }) => {
		displayName = _displayName;
		discountPercentage = _discountPercentage;
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

	const create = () =>
		db.update((db) =>
			db
				.insertInto("warehouses")
				.values({ id, displayName: "", discountPercentage: 0 })
				.onConflict((oc) => oc.doNothing())
				.execute()
		);

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

		async create() {
			return runUpdate(create);
		},
		async get() {
			return runUpdate(() => Promise.resolve());
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

export const createNoteInterface = (
	db: InventoryDatabaseInterface,
	warehouseId: string,
	_id?: string,
	data?: Partial<Schema<S>["notes"]>
): NoteInterface => {
	const id: string = _id || uniqueTimestamp();

	const noteType = (warehouseId === "all" ? "inventory" : "inbound") as NoteType;

	// Use the seed data if provided, if not set to default (if note exists the values will be updated by the stream)
	let {
		displayName = "",
		committed = false,
		createdAt = null,
		updatedAt = null,
		committedAt = null,
		reconciliationNote = false
	} = data || {};

	const streamed = () =>
		observableFromStore(db.replicated((db) => db.selectFrom("notes").where("id", "==", _id).selectAll())).pipe(map(([n]) => n));
	streamed().subscribe((n) => {
		displayName = n.displayName;
		committed = n.committed;

		createdAt = n.createdAt;
		updatedAt = n.updatedAt;
		committedAt = n.committedAt ?? null;
		reconciliationNote = n.reconciliationNote;
	});

	const streamedEntries = () => {
		const books = observableFromStore(
			db.replicated((db) =>
				db
					.selectFrom("bookTransactions as t")
					.leftJoin("warehouses as w", "t.warehouseId", "w.id")
					.where("t.noteId", "==", _id)
					.select(["t.isbn", "t.quantity", "t.warehouseId", "w.displayName as warehouseName", "w.discountPercentage as warehouseDiscount"])
			)
		);

		const customItems = observableFromStore(
			db.replicated((db) =>
				db.selectFrom("customItemTransactions as t").where("t.noteId", "==", _id).select(["t.id", "t.title", "t.price"])
			)
		);

		return combineLatest([books, customItems]).pipe(
			map(([b, ca]) => (b as VolumeStockClient[]).concat(ca.map((ca) => ({ ...ca, __kind: "custom" }))))
		);
	};

	const getReceiptItems = () => {
		const books = observableFromStore(
			db.replicated((db) =>
				db
					.selectFrom("bookTransactions as t")
					.leftJoin("warehouses as w", "t.warehouseId", "w.id")
					.leftJoin("books as b", "t.isbn", "b.isbn")
					.where("t.noteId", "==", _id)
					.select(["t.isbn", "b.title", "t.quantity", "b.price", "w.discountPercentage as discount"])
			)
		).pipe(map((x) => x as ReceiptItem[]));

		const customItems = observableFromStore(
			db.replicated((db) => db.selectFrom("customItemTransactions as t").where("t.noteId", "==", _id).select(["t.title", "t.price"]))
		).pipe(map((ci) => ci.map(({ title, price }) => ({ title, price, quantity: 1, discount: 0 }))));

		const full = combineLatest([books, customItems]).pipe(map(([b, ci]) => b.concat(ci)));
		return firstValueFrom(full);
	};

	const create = async () => {
		const createdAt = new Date().toISOString();
		const updatedAt = createdAt;

		// This is a noop if warehouse already exists
		await db.warehouse(warehouseId).create();
		return db.update((db) =>
			// TODO: default name - naming sequence
			db
				.insertInto("notes")
				.values({ id: _id, warehouseId, displayName: "", committed: false, createdAt, updatedAt, noteType, reconciliationNote: false })
				.execute()
		);
	};

	const addVolumes = async (...volumes: VolumeStock[]) => {
		const [_books, _customIteme] = wrapIter(volumes).partition(isBookRow);
		const books = _books.map((txn) => ({ ...txn, noteId: _id })).array();
		const customItems = _customIteme.map((txn) => ({ ...txn, noteId: _id })).array();

		await Promise.all([
			!books.length
				? Promise.resolve()
				: db.update((db) =>
						db
							.insertInto("bookTransactions")
							.values(books)
							.onConflict((oc) => oc.doUpdateSet({ quantity: sql`sql.ref("excluded.quantity") + sql.ref("excluded.quantity")` }))
							.execute()
				  ),
			!customItems.length
				? Promise.resolve()
				: db.update((db) =>
						db
							.insertInto("customItemTransactions")
							.values(customItems)
							.onConflict((oc) => oc.doNothing())
							.execute()
				  )
		]);
	};

	const updateTransaction = async (params: UpdateTransactionParams<"book"> | UpdateTransactionParams<"custom">) => {
		if (typeof params[0] === "string") {
			const [id, update] = params as UpdateTransactionParams<"custom">;
			await db.update((db) =>
				db.updateTable("customItemTransactions").where("noteId", "==", _id).where("id", "==", id).set(update).execute()
			);
		} else {
			const [match, update] = params as UpdateTransactionParams<"book">;
			const matchIsbn = match.isbn;
			const matchWarehouseId = match.warehouseId || (noteType === "inbound" ? warehouseId : "");

			// We're removing the matched transaction first, as changing the warehouseId might result in aggregation
			// with the existing (isbn/warehouseId) entry - in which case the quantities are aggregated
			await db.update((db) =>
				db
					.deleteFrom("bookTransactions")
					.where("noteId", "==", _id)
					.where("isbn", "==", matchIsbn)
					.where("warehouseId", "==", matchWarehouseId)
					.execute()
			);

			// After removing the match txn, we're running addVolumes - it will take care of insertion
			// or aggregation of the new transaction
			await addVolumes({ ...match, ...update });
		}
	};

	const removeTransactions = (...transactions: Array<VolumeStock<"custom">["id"] | Omit<VolumeStock<"book">, "quantity">>) => {
		const [_books, _customItems] = wrapIter(transactions).partition((t) => typeof t !== "string");

		const books = _books.array();

		const customItems = _customItems.array();

		return Promise.all([
			books.map(({ isbn, warehouseId }) =>
				db.update((db) =>
					db
						.deleteFrom("bookTransactions")
						.where("noteId", "==", _id)
						.where("isbn", "==", isbn)
						.where("warehouseId", "==", warehouseId)
						.execute()
				)
			),
			!customItems.length
				? Promise.resolve()
				: db.update((db) => db.deleteFrom("customItemTransactions").where("noteId", "==", _id).where("id", "in", customItems).execute())
		]);
	};

	const commit = async () => {
		// TODO: blockers/reconciliation
		await db.update((db) => db.updateTable("notes").where("id", "==", _id).set("committed", true).execute());
	};

	/** A helper used to await the updated data (after an update) and return the updated note interface */
	const runUpdate = async (cb: () => Promise<any>) => {
		// If note is committed, we can't update it
		if (committed) throw new Error("Cannot update a committed note"); // TODO: check if there's a standard err for this

		// Perform the update
		await cb();

		// Return the updated note interface
		const data = await firstValueFrom(streamed());
		return createNoteInterface(db, warehouseId, _id, data);
	};

	const updateField = <F extends keyof Schema<S>["notes"]>(field: F, value: Schema<S>["notes"][F]) =>
		runUpdate(() =>
			db.update((db) =>
				db
					.updateTable("notes")
					.where("id", "==", _id)
					.set({ [field]: value })
					.execute()
			)
		);

	const stream = (): NoteStream => {
		return {
			displayName: () => streamed().pipe(map(({ displayName }) => displayName)),
			state: () => streamed().pipe(map(({ committed }) => (committed ? NoteState.Committed : NoteState.Draft))),
			entries: () => streamedEntries().pipe(map((rows) => ({ rows, total: rows.filter(isBookRow).reduce((a, b) => a + b.quantity, 0) }))),
			defaultWarehouseId: () => streamed().pipe(map(({ defaultWarehouse }) => defaultWarehouse || "")),
			updatedAt: () => streamed().pipe(map(({ updatedAt }) => (updatedAt ? new Date(updatedAt) : null)))
		};
	};

	return {
		id,

		noteType,

		displayName,
		committed,

		createdAt,
		updatedAt,
		committedAt,

		reconciliationNote,

		async create() {
			return runUpdate(create);
		},

		get() {
			return runUpdate(() => Promise.resolve()); // Empty update to load the data
		},

		async delete() {
			if (committed) throw new Error("Cannot delete a committed note"); // TODO: check if there's a standard err for this
			await db.update((db) => db.deleteFrom("notes").where("id", "==", _id).execute());
		},

		getEntries() {
			return firstValueFrom(streamedEntries());
		},

		setName(_: any, name: string) {
			return updateField("displayName", name);
		},

		setReconciliationNote(_: any, value: boolean) {
			return updateField("reconciliationNote", value);
		},

		setDefaultWarehouse(_: any, warehouseId: string) {
			return updateField("defaultWarehouse", warehouseId);
		},

		addVolumes(...volumes: VolumeStock[]) {
			return runUpdate(() => addVolumes(...volumes));
		},

		async updateTransaction(_: any, ...params: UpdateTransactionParams<"book"> | UpdateTransactionParams<"custom">) {
			return runUpdate(() => updateTransaction(params));
		},

		removeTransactions(...transactions: Array<VolumeStock<"custom">["id"] | Omit<VolumeStock<"book">, "quantity">>) {
			return runUpdate(() => removeTransactions(...transactions));
		},

		async commit() {
			return runUpdate(commit);
		},

		async intoReceipt() {
			const items = await getReceiptItems();
			return { timestamp: Date.now(), items };
		},

		async reconcile() {
			// TODO
			return runUpdate(() => Promise.resolve());
		},

		stream
	};
};

// TODO: perhaps add more fine-grained controls for history (not subscribe to the entire transactions table if not necessary)
const createHistoryInterface = (db: InventoryDatabaseInterface): HistoryInterface => {
	const newPastTransactionsMap = (
		rows: Array<
			VolumeStock<"book"> & {
				noteId: string;
				noteType: string;
				noteDisplayName: string;
				createdAt: string;
				updatedAt?: string | null;
				committedAt?: string | null;
			}
		>
	) => {
		const internal = rows.map(({ createdAt, updatedAt, committedAt, noteType, ...row }) => ({
			...row,
			noteType: noteType as NoteType,
			// In practice this should always be 'committedAt', but we're doing this to keep TS happy,
			// and for backwards compatibility
			date: committedAt ?? updatedAt ?? createdAt
		}));
		return {
			by(key: keyof PastTransaction) {
				return wrapIter(internal)._groupIntoMap((entry) => [entry[key], entry]);
			}
		};
	};

	return {
		stream() {
			return observableFromStore(
				db.replicated((db) =>
					db
						.selectFrom("notes as n")
						.innerJoin("bookTransactions as t", "n.id", "t.noteId")
						.where("n.committed", "==", true)
						.select([
							"t.isbn",
							"t.warehouseId",
							"t.quantity",
							"n.id as noteId",
							"n.displayName as noteDisplayName",
							"n.noteType",
							"n.createdAt",
							"n.updatedAt",
							"n.committedAt"
						])
				)
			).pipe(map(newPastTransactionsMap));
		}
	} as HistoryInterface;
};

export const newDatabase: InventoryDatabaseConstructor = (_name, { test = false } = {}) => {
	// If testing, we're namespacing the db as SQLite writes to fs, so it's easy to write to the designated folder,
	// and then, clean up and / or ignore the folder
	const name = test ? `test-dbs/${_name}` : _name;
	return createDB(schema, name);
};
