import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable, ReplaySubject, share, Subject, tap } from "rxjs";

import { NoteState, debug, VolumeStock, wrapIter } from "@librocco/shared";

import { DocType } from "@/enums";

import {
	NoteType,
	PickPartial,
	EntriesStreamResult,
	VolumeStockClient,
	OutOfStockTransaction,
	ReceiptData,
	UpdateTransactionParams
} from "@/types";
import { VersionedString, NoteInterface, WarehouseInterface, NoteData, InventoryDatabaseInterface } from "./types";

import { isBookRow, isCustomItemRow, isEmpty, runAfterCondition, uniqueTimestamp } from "@/utils/misc";
import { newDocumentStream, versionId, addWarehouseData, combineTransactionsWarehouses, TableData } from "./utils";
import {
	EmptyNoteError,
	OutOfStockError,
	TransactionWarehouseMismatchError,
	EmptyTransactionError,
	NoWarehouseSelectedError
} from "@/errors";

class Note implements NoteInterface {
	// We wish the warehouse back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#w: WarehouseInterface;
	#db: InventoryDatabaseInterface;

	#initialized = new BehaviorSubject(false);
	#exists = false;

	// Update stream receives the latest document (update) stream from the db. It's multicasted using plain RxJS Subject (no repeat or anything).
	// This stream is used to signal the update has happened (and has been streamed to update the instance). Subscribers needing to be notified when
	// an update happens should subscribe to this stream.
	#updateStream: Observable<NoteData>;
	// The stream is piped from the update stream, only it's multicasted using a ReplaySubject, which will cache the last value emitted by the stream,
	// for all new subscribers. Subscribers needing the latest (up-to-date) data and not needing to be notified when the NEXT update happened, should
	// subscribe to this stream.
	#stream: Observable<NoteData>;

	_id: VersionedString;
	docType = DocType.Note;
	_rev?: string;
	_deleted?: boolean;

	id = "";
	noteType: NoteType;
	reconciliationNote?: boolean;
	defaultWarehouseId?: string | undefined;

	entries: VolumeStock[] = [];
	committed = false;
	displayName = "";

	createdAt: string | null = null;
	updatedAt: string | null = null;
	committedAt: string | null = null;

	constructor(warehouse: WarehouseInterface, db: InventoryDatabaseInterface, id?: string) {
		this.#w = warehouse;
		this.#db = db;

		// Outbound notes are assigned to the default warehouse, while inbound notes are assigned to a non-default warehouse
		this.noteType = warehouse.id === "0-all" ? "outbound" : "inbound";

		const idSegments = id?.split("/").filter(Boolean) || [];

		// If id provided, validate it:
		// - it should either be a full id - 'v1/<warehouse-id>/<note-type>/<note-id>'
		// - or a single segment id - '<note-id>'
		if (id && idSegments.length !== 1) {
			throw new Error("Invalid note id: " + id);
		}

		// Store the id internally:
		// - if id is a single segment id, prepend the warehouse id and note type, and version the string
		// - if id is a full id, assign it as is
		this._id = versionId(`${warehouse._id}/${this.noteType}/${id || uniqueTimestamp()}`);
		this.id = this._id.split("/").pop()!;

		// Create the internal document stream, which will be used to update the local instance on each change in the db.
		const updateSubject = new Subject<NoteData>();
		const cache = new ReplaySubject<NoteData>(1);
		this.#updateStream = newDocumentStream<NoteData>({}, this.#db._pouch, this._id).pipe(
			share({ connector: () => updateSubject, resetOnError: false, resetOnComplete: false, resetOnRefCountZero: false })
		);
		this.#stream = this.#updateStream.pipe(
			// We're connecting the stream to a ReplaySubject as a multicast object: this enables us to share the internal stream
			// with the exposed streams (displayName) and to cache the last value emitted by the stream: so that each subscriber to the stream
			// will get the 'initialValue' (repeated value from the latest stream).
			share({ connector: () => cache, resetOnError: false, resetOnComplete: false, resetOnRefCountZero: false })
		);

		// The first value from the stream will be either note data, or an empty object (if the note doesn't exist in the db).
		// This is enough to signal that the note intsance is initialised.
		firstValueFrom(this.#stream).then(() => this.#initialized.next(true));
		// If data is not empty (note exists), setting of 'exists' flag is handled inside the 'updateInstance' method.
		this.#stream.subscribe((w) => this.updateInstance(w));

		return this;
	}

	/**
	 * Update field is a method for internal usage, used to update the local field, if the value is provided
	 */
	private updateField<K extends keyof NoteData>(field: K, value?: NoteData[K]) {
		if (value !== undefined) {
			this[field] = value as any;
		}
		this.#exists = true;
		return this;
	}

	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private updateInstance(data: Partial<Omit<NoteData, "_id">>): NoteInterface {
		// No-op if the data is empty
		if (isEmpty(data)) {
			return this;
		}

		// Update the data with provided fields
		this.updateField("_rev", data._rev);
		this.updateField("noteType", data.noteType);
		this.updateField("committed", data.committed);
		this.updateField("entries", data.entries);
		this.updateField("defaultWarehouseId", data.defaultWarehouseId);
		this.updateField("displayName", data.displayName);
		this.updateField("updatedAt", data.updatedAt);
		this.updateField("committedAt", data.committedAt);
		this.updateField("reconciliationNote", data.reconciliationNote);

		this.#exists = true;

		return this;
	}

	/**
	 * If note doesn't exist in the db, create an entry with initial values.
	 * No-op otherwise.
	 */
	create(): Promise<NoteInterface> {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}
			// If creating a note, we're also creating a warehouse. If the warehouse
			// already exists, this is a no-op anyhow.
			// No need to await this, as the warehouse is not needed for the note to function.
			this.#w.create();

			const createdAt = new Date().toISOString();
			const updatedAt = createdAt;

			const sequentialNumber = (await this.#db._pouch.query("v1_sequence/note")).rows[0];
			const seqIndex = sequentialNumber ? sequentialNumber.value.max && ` (${sequentialNumber.value.max + 1})` : "";

			const initialValues = { ...this, displayName: `New Note${seqIndex}`, createdAt, updatedAt };
			const { rev } = await this.#db._pouch.put<NoteData>(initialValues);

			return this.updateInstance({ ...initialValues, _rev: rev });
		}, this.#initialized);
	}

	/**
	 * Returns this note instance, populated with the data from the db (hence the promise return type).
	 * If instance has already been initialised, resolves immediately, if not, resolves after initalisation.
	 * If the note doesn't exist in the db, returns `undefined`.
	 *
	 * We use this to explicitly ensure the instance is initialised (this is not needed for other methods, as they run after initialisation anyway).
	 * We can also use this to check if the note exists in the db.
	 */
	get(): Promise<NoteInterface | undefined> {
		return runAfterCondition(() => {
			if (this.#exists) {
				return Promise.resolve(this);
			}
			return Promise.resolve(undefined);
		}, this.#initialized);
	}

	/**
	 * Update is private as it's here for internal usage, while all updates to warehouse document
	 * from outside the instance have their own designated methods.
	 */
	private update(ctx: debug.DebugCtx, data: Partial<NoteInterface>) {
		return runAfterCondition(async () => {
			debug.log(ctx, "note:update")({ data });

			// Committed notes cannot be updated.
			if (this.committed) {
				debug.log(ctx, "note:update:note_committed")(this);
				return this;
			}

			// If creating a note, we're also creating a warehouse. If the warehouse
			// already exists, this is a no-op anyhow.
			// No need to await this, as the warehouse is not needed for the note to function.
			this.#w.create();

			const updatedData = { ...this, ...data, updatedAt: new Date().toISOString() };
			debug.log(ctx, "note:updating")({ updatedData });
			const { rev } = await this.#db._pouch.put<NoteData>(updatedData);
			debug.log(ctx, "note:updated")({ updatedData, rev });

			// We're waiting for the first value from stream (updating local instance) before resolving the
			// update promise.
			await firstValueFrom(this.#updateStream);
			return this;
		}, this.#initialized);
	}

	/**
	 * Delete the note from the db.
	 */
	delete(ctx: debug.DebugCtx = {}): Promise<void> {
		debug.log(ctx, "note:delete")({});
		return runAfterCondition(async () => {
			// Committed notes cannot be deleted.
			if (!this.#exists || this.committed) {
				return;
			}
			await this.#db._pouch.put({ ...this, _deleted: true });
		}, this.#initialized);
	}

	/**
	 * Update note display name.
	 */
	setName(ctx: debug.DebugCtx, displayName: string): Promise<NoteInterface> {
		const currentDisplayName = this.displayName;
		debug.log(ctx, "note:set_name")({ displayName, currentDisplayName });

		if (displayName === currentDisplayName || !displayName) {
			debug.log(ctx, "note:set_name:noop")({ displayName, currentDisplayName });
			return Promise.resolve(this);
		}

		debug.log(ctx, "note:set_name:updating")({ displayName });
		return this.update(ctx, { displayName });
	}

	/**
	 * Update default warehouse.
	 */
	setDefaultWarehouse(ctx: debug.DebugCtx, warehouseId: string): Promise<NoteInterface> {
		const currentDefaultWarehouseId = this.defaultWarehouseId;
		debug.log(ctx, "note:set_default_warehouse")({ warehouseId, currentDefaultWarehouseId });

		if (warehouseId === currentDefaultWarehouseId || !warehouseId || this.noteType !== "outbound") {
			debug.log(ctx, "note:set_defaultwarehouse:noop")({ warehouseId, currentDefaultWarehouseId });
			return Promise.resolve(this);
		}

		debug.log(ctx, "note:set_defaultwarehouse:updating")({ warehouseId });
		return this.update(ctx, { defaultWarehouseId: warehouseId });
	}

	/**
	 * Mark the note as reconciliation note (see types for more info)
	 */
	setReconciliationNote(ctx: debug.DebugCtx, value: boolean) {
		debug.log(ctx, "note:set_reconciliation_note")({ value });
		return this.update(ctx, { reconciliationNote: value });
	}

	/**
	 * Add volumes accepts an object or multiple objects of VolumeStock updates (isbn, quantity, warehouseId?) for
	 * book quantities. If a volume with a given isbn is found, the quantity is aggregated, otherwise a new
	 * entry is pushed to the list of entries.
	 */
	addVolumes(
		_: debug.DebugCtx,
		...params: Array<PickPartial<VolumeStock<"custom">, "id"> | PickPartial<VolumeStock<"book">, "warehouseId">>
	): Promise<NoteInterface> {
		return runAfterCondition(() => {
			params.map((update) => {
				// Custom items are merely added, not aggregated
				if (update.__kind === "custom") {
					// Generate a random id only if not provided.
					// This will be the case most of the time, but for testing, it's sometimes convenient to be able to explicitly specify the id.
					const id = update.id || uniqueTimestamp();
					this.entries.push({ ...update, id });
					return;
				}

				if (!update.isbn) throw new EmptyTransactionError();

				update.warehouseId = update.warehouseId
					? update.warehouseId
					: this.noteType === "inbound"
						? this.#w.id
						: this.defaultWarehouseId || "";

				const matchIndex = this.entries
					.filter(isBookRow)
					.findIndex((entry) => entry.isbn === update.isbn && entry.warehouseId === update.warehouseId);

				// If transaction doesn't already exist, create a new one
				if (matchIndex === -1) {
					this.entries.push(update as VolumeStock<"book">);
					return;
				}

				// If transaction already exists, aggregate the quantity, but push it to the top of the list (we're displaying the list in reverse)
				const [existing] = this.entries.splice(matchIndex, 1) as VolumeStock<"book">[];
				this.entries.push({ ...existing, quantity: existing.quantity + update.quantity } as VolumeStock<"book">);
			});

			return this.update({}, this);
		}, this.#initialized);
	}

	updateTransaction(ctx: debug.DebugCtx, ...params: UpdateTransactionParams): Promise<NoteInterface> {
		debug.log(ctx, "update_transaction:params")({ params });
		// Update custom item
		if (typeof params[0] === "string") {
			debug.log(ctx, "update_transaction:custom_item:updating")({});

			const [id, update] = params as UpdateTransactionParams<"custom">;
			const ix = this.entries.findIndex((e) => isCustomItemRow(e) && e.id === id);

			if (ix === -1) {
				debug.log(ctx, "update_transaction:custom_item:no_item_found")({});
				return Promise.resolve(this);
			}

			debug.log(ctx, "update_transaction:custom_item:found_item")({ ix, item: this.entries[ix] });
			this.entries[ix] = { ...(this.entries[ix] as VolumeStock<"custom">), ...update };
			return this.update(ctx, this);
		}

		// Update book transaction row
		debug.log(ctx, "update_transaction:book_row:updating")({});

		const [match, update] = params as UpdateTransactionParams<"book">;

		const matchTr = {
			...match,
			warehouseId: match.warehouseId ? match.warehouseId : this.noteType === "inbound" ? this.#w.id : ""
		};

		const updateTr = {
			isbn: update.isbn,
			quantity: update.quantity,
			warehouseId: update.warehouseId ? update.warehouseId : this.noteType === "inbound" ? this.#w.id : ""
		};

		debug.log(ctx, "update_transaction:book_row:data")({ matchTr, updateTr });

		// Find the transaction we're updating
		const matchIx = this.entries.findIndex((e) => isBookRow(e) && e.isbn === matchTr.isbn && e.warehouseId === matchTr.warehouseId);

		if (matchIx === -1) {
			// No transaction to update: exit early
			debug.log(ctx, "update_transaction:book_row:no_item_found")({});
			return this.update(ctx, {}); // Noop update
		}

		// Check if there already exists a transation with same isbn/warehouse as the one we're updating to (in which case we're merely aggregating)
		//
		// Start by excluding the transaction from entries - this prevents faulty behaviour when only updating quantity
		const otherEntries = [...this.entries];
		otherEntries.splice(matchIx, 1);

		const updateMatchIx = otherEntries.findIndex((e) => isBookRow(e) && e.isbn === updateTr.isbn && e.warehouseId === updateTr.warehouseId);

		// There already exists a transaction with same isbn/warehouse id - aggregate the quantity
		//
		// Use the 'otherEntries' as the old transaction no longer exists as such - it's getting merged with another txn
		if (updateMatchIx !== -1) {
			(otherEntries[updateMatchIx] as VolumeStock<"book">).quantity += updateTr.quantity;
			return this.update(ctx, { entries: otherEntries });
		}

		// There's no transaction with same isbn/warehouse id - merely update the existing txn
		//
		// Notice we're using the existing entries - this preserves the order
		this.entries[matchIx] = updateTr;

		return this.update(ctx, this);
	}

	removeTransactions(
		_: debug.DebugCtx,
		...transactions: Array<VolumeStock<"custom">["id"] | Omit<VolumeStock<"book">, "quantity">>
	): Promise<NoteInterface> {
		const [_customItems, _books] = wrapIter(transactions).partition((e): e is string => typeof e === "string");
		const [customItemRows, bookRows] = wrapIter(this.entries).partition(isCustomItemRow);

		// If this is an inbound note, we infer the warehouse id from the note itself.
		// If this is an outbound note, we read the transaction's warehouse id, or falling back to an empty string (warhehouse not assigned).
		const noteWarehouse = this.noteType === "inbound" ? this.#w._id : "";
		const booksToRemove = wrapIter(_books)
			.map((e) => ({
				isbn: e.isbn,
				warehouseId: e.warehouseId || noteWarehouse
			}))
			.array();

		const customItemsToRemove = wrapIter(_customItems).array();

		const filteredBookRows = bookRows.filter((e) => !booksToRemove.some((b) => b.isbn === e.isbn && b.warehouseId === e.warehouseId));
		const filteredCustomItemRows = customItemRows.filter((e) => !customItemsToRemove.includes(e.id));

		const entries = [...filteredBookRows, ...filteredCustomItemRows];

		return this.update({}, { entries });
	}

	/**
	 * Checks that all transactions in an inbound note are assigned to the parent warehouse.
	 * @returns a list of all invlid transactions in that regard.
	 */
	private getInvalidInboundTransactions(): VolumeStock<"book">[] {
		// All transactions in an inbound note must be assigned to the same (note parent) warehouse.
		return this.entries.filter(isBookRow).filter(({ warehouseId }) => warehouseId !== this.#w.id);
	}

	/**
	 * Checks that all transactions have a warehouse assigned to them.
	 * @returns a list of all invalid transactions in that regard.
	 */
	private getNoWarehouseTransactions(): VolumeStock<"book">[] {
		return this.entries.filter(isBookRow).filter(({ warehouseId }) => !warehouseId);
	}

	private async getOutOfStockTransactions(): Promise<OutOfStockTransaction[]> {
		const stock = await this.#db.getStock();
		const warehouseMap = await firstValueFrom(this.#db.stream().warehouseMap({}));
		return (
			this.entries
				.filter(isBookRow)
				.map(({ isbn, quantity, warehouseId }) => ({
					isbn,
					quantity,
					warehouseId,
					available: stock.isbn(isbn).get([isbn, warehouseId])?.quantity || 0,
					warehouseName: warehouseMap.get(warehouseId)?.displayName || "unkonwn"
				}))
				// Filter out transactions that are valid
				.filter(({ quantity, available }) => quantity > available)
		);
	}

	/**
	 * Commit the note, disabling further updates and deletions. Committing a note also accounts for note's transactions
	 * when calculating the stock of the warehouse.
	 */
	async commit(ctx: debug.DebugCtx = {}, options?: { force: boolean }): Promise<NoteInterface> {
		debug.log(ctx, "note:commit")({});

		// Don't allow for committing of empty notes.
		// We're allowing commit if 'force === true' (this should only be used in tests)
		if (this.entries.length === 0 && !options?.force) {
			throw new EmptyNoteError();
		}

		// Check transactions before committing
		switch (this.noteType) {
			case "inbound": {
				// Check that all transactions are assigned to the parent warehouse
				const invalidTransactions = this.getInvalidInboundTransactions();
				if (invalidTransactions.length) {
					throw new TransactionWarehouseMismatchError(this.#w.id, invalidTransactions);
				}
				break;
			}
			case "outbound": {
				// Check for transactions without a warehouse assigned - outbound note can't be committed in this state
				const invalidTransactions = this.getNoWarehouseTransactions();
				if (invalidTransactions.length) {
					throw new NoWarehouseSelectedError(invalidTransactions);
				}

				// Check for out-of-stock transactions - outbound note can't be committed in this state, but the state can be reconciled
				const outOfStockTransactions = await this.getOutOfStockTransactions();
				if (outOfStockTransactions.length) {
					throw new OutOfStockError(outOfStockTransactions);
				}
			}
		}
		const committedAt = new Date().toISOString();

		return this.update(ctx, { committed: true, committedAt });
	}

	reconcile(ctx: debug.DebugCtx = {}): Promise<NoteInterface> {
		return runAfterCondition(async () => {
			// Only outbound note can be reconciled
			const inbound = this.noteType === "inbound";
			// Committed notes don't need reconciliation
			const committed = this.committed;
			if (inbound || committed) {
				debug.log(ctx, "note:reconcile:noop")({ noteType: this.noteType, committed });
				return this;
			}

			const stock = await this.#db.getStock();

			const toUpdate = wrapIter(this.entries)
				// Custom items are irrelevant for this action
				.filter(isBookRow)
				// Filter out rows with no 'warehouseId' assigned - those aren't ready
				// for reconciliation and should be handled somewhere else
				.filter(({ warehouseId }) => Boolean(warehouseId))
				// Check the difference in quantity available and quantity demanded
				.map(({ isbn, warehouseId, quantity }) => ({ warehouseId, isbn, diff: stock.getQuantity([isbn, warehouseId]) - quantity }))
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
					.then((n) => n.addVolumes(ctx, ...transactions))
					.then((n) => n.commit(ctx))
			);
			await Promise.all(updates);

			return this;
		}, this.#initialized);
	}

	async getEntries(): Promise<Iterable<VolumeStockClient>> {
		const entries = await this.get().then((note) => note?.entries || []);
		const warehouses = await this.#db.getWarehouseDataMap();
		return addWarehouseData(entries, warehouses);
	}

	async intoReceipt(ctx: debug.DebugCtx): Promise<ReceiptData> {
		const timestamp = Number(new Date());
		const entries = await this.getEntries().then((e) => [...e]);
		const [bookEntries, customItemEntries] = wrapIter(entries).partition(isBookRow);
		const bookData = await this.#db.books().get(
			ctx,
			bookEntries.array().map(({ isbn }) => isbn)
		);
		const bookEntriesFull = wrapIter(bookEntries)
			.zip(bookData)
			.map(([{ isbn, quantity, warehouseDiscount: discount }, { title = "", price = 0 } = {}]) => ({
				isbn,
				title,
				quantity,
				price,
				discount
			}));
		const items = [...bookEntriesFull, ...customItemEntries.map((e) => ({ ...e, quantity: 1, discount: 0 }))];
		return { timestamp, items };
	}

	/**
	 * Creates streams for the note data. The streams are hot in a way that they will
	 * emit the value from external source (i.e. db), but cold in a way that the db subscription is
	 * initiated only when the stream is subscribed to (and canceled on unsubscribe).
	 */
	stream() {
		return {
			displayName: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "note_streams: display_name: input")),
					map(({ displayName }) => displayName || ""),
					tap(debug.log(ctx, "note_streams: display_name: res"))
				),

			defaultWarehouseId: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "note_streams: defaultWarehouseId: input")),
					map(({ defaultWarehouseId }) => defaultWarehouseId || ""),
					tap(debug.log(ctx, "note_streams: defaultWarehouseId: res"))
				),

			// Combine latest is like an rxjs equivalent of svelte derived stores with multiple sources.
			entries: (ctx: debug.DebugCtx): Observable<EntriesStreamResult> => {
				return combineLatest([
					this.#stream.pipe(
						map(
							({ entries = [] }): TableData => ({
								rows: entries.map((e) => (isCustomItemRow(e) ? e : { ...e, warehouseName: "" })).reverse(),
								total: entries.length
							})
						)
					),
					this.#db.stream().warehouseMap(ctx),
					this.#db.stream().stock()
				]).pipe(
					tap(debug.log(ctx, "note:entries:stream:input")),
					map(
						combineTransactionsWarehouses({
							includeAvailableWarehouses: this.noteType === "outbound"
						})
					),
					tap(debug.log(ctx, "note:entries:stream:output"))
				);
			},

			state: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "note_streams: state: input")),
					map(({ committed, _deleted }) => (_deleted ? NoteState.Deleted : committed ? NoteState.Committed : NoteState.Draft)),
					tap(debug.log(ctx, "note_streams: state: res"))
				),

			updatedAt: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "note_streams: updated_at: input")),
					map(({ updatedAt: ua }) => (ua ? new Date(ua) : null)),
					tap(debug.log(ctx, "note_streams: updated_at: res"))
				)
		};
	}
}

export const newNote = (w: WarehouseInterface, db: InventoryDatabaseInterface, id?: string): NoteInterface => {
	return new Note(w, db, id);
};
