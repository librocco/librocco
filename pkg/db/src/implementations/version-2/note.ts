import { Schema, sql } from "crstore";
import { combineLatest, firstValueFrom, map } from "rxjs";

import { NoteState, VolumeStock, wrapIter } from "@librocco/shared";

import { NoteStream, NoteType, ReceiptItem, UpdateTransactionParams, VolumeStockClient } from "@/types";
import { InventoryDatabaseInterface, DatabaseSchema, NoteInterface } from "./types";

import { isBookRow, uniqueTimestamp } from "@/utils/misc";
import { observableFromStore } from "@/helpers";

export const createNoteInterface = (
	db: InventoryDatabaseInterface,
	warehouseId: string,
	_id?: string,
	data?: Partial<Schema<DatabaseSchema>["notes"]>
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

	const updateField = <F extends keyof Schema<DatabaseSchema>["notes"]>(field: F, value: Schema<DatabaseSchema>["notes"][F]) =>
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
