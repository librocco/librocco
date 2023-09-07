import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable, ReplaySubject, share, Subject, tap } from "rxjs";

import { NoteState, debug } from "@librocco/shared";

import { DocType } from "@/enums";

import { NoteType, VolumeStock, VersionedString, PickPartial, EntriesStreamResult, VolumeStockClient } from "@/types";
import { NoteInterface, WarehouseInterface, NoteData, DatabaseInterface } from "./types";

import { versionId } from "./utils";
import { isEmpty, isVersioned, runAfterCondition, sortBooks, uniqueTimestamp } from "@/utils/misc";
import { newDocumentStream } from "@/utils/pouchdb";
import { EmptyNoteError, OutOfStockError, TransactionWarehouseMismatchError, EmptyTransactionError } from "@/errors";
import { addWarehouseNames, combineTransactionsWarehouses, TableData } from "./utils";

class Note implements NoteInterface {
	// We wish the warehouse back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#w: WarehouseInterface;
	#db: DatabaseInterface;

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

	noteType: NoteType;

	entries: VolumeStock[] = [];
	committed = false;
	displayName = "";
	updatedAt: string | null = null;

	constructor(warehouse: WarehouseInterface, db: DatabaseInterface, id?: string) {
		this.#w = warehouse;
		this.#db = db;

		// Outbound notes are assigned to the default warehouse, while inbound notes are assigned to a non-default warehouse
		this.noteType = warehouse._id === versionId("0-all") ? "outbound" : "inbound";

		const idSegments = id?.split("/").filter(Boolean) || [];

		// If id provided, validate it:
		// - it should either be a full id - 'v1/<warehouse-id>/<note-type>/<note-id>'
		// - or a single segment id - '<note-id>'
		if (id && ![1, 4].includes(idSegments.length)) {
			throw new Error("Invalid note id: " + id);
		}

		// If warehouse provided as part of the id, verify there's
		// no mismatch between backreferenced warehouse and the provided one.
		if (idSegments.length === 4 && idSegments[1] !== warehouse._id) {
			const wId = versionId(idSegments[1]);
			const refWId = versionId(warehouse._id);
			if (wId !== refWId) {
				throw new Error(
					"Warehouse referenced in the note and one provided in note id mismatch:" + "\n		referenced: " + refWId + "\n		provided: " + wId
				);
			}
		}

		// Store the id internally:
		// - if id is a single segment id, prepend the warehouse id and note type, and version the string
		// - if id is a full id, assign it as is
		this._id = !id
			? versionId(`${warehouse._id}/${this.noteType}/${uniqueTimestamp()}`)
			: isVersioned(id, "v1") // If id is versioned, it's a full id, assign it as is
			? id
			: versionId(`${warehouse._id}/${this.noteType}/${id}`);

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
		this.updateField("displayName", data.displayName);
		this.updateField("updatedAt", data.updatedAt);

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

			const updatedAt = new Date().toISOString();

			const sequentialNumber = (await this.#db._pouch.query("v1_sequence/note")).rows[0];
			const seqIndex = sequentialNumber ? sequentialNumber.value.max && ` (${sequentialNumber.value.max + 1})` : "";

			const initialValues = { ...this, displayName: `New Note${seqIndex}`, updatedAt };
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
	delete(ctx: debug.DebugCtx): Promise<void> {
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
	 * Add volumes accepts an object or multiple objects of VolumeStock updates (isbn, quantity, warehouseId?) for
	 * book quantities. If a volume with a given isbn is found, the quantity is aggregated, otherwise a new
	 * entry is pushed to the list of entries.
	 */
	addVolumes(...params: Parameters<NoteInterface["addVolumes"]>): Promise<NoteInterface> {
		return runAfterCondition(async () => {
			params.forEach((update) => {
				if (!update.isbn) throw new EmptyTransactionError();
				const warehouseId = update.warehouseId ? versionId(update.warehouseId) : this.noteType === "inbound" ? this.#w._id : "";

				const matchIndex = this.entries.findIndex((entry) => entry.isbn === update.isbn && entry.warehouseId === warehouseId);

				if (matchIndex === -1) {
					this.entries.push({ isbn: update.isbn, warehouseId, quantity: update.quantity });
					return;
				}

				this.entries[matchIndex] = {
					isbn: update.isbn,
					warehouseId,
					quantity: this.entries[matchIndex].quantity + update.quantity
				};
			});

			return this.update({}, this);
		}, this.#initialized);
	}

	updateTransaction(match: PickPartial<Omit<VolumeStock, "quantity">, "warehouseId">, update: VolumeStock): Promise<NoteInterface> {
		const matchTr = {
			...match,
			warehouseId: match.warehouseId ? versionId(match.warehouseId) : this.noteType === "inbound" ? this.#w._id : ""
		};

		const updateTr = {
			isbn: update.isbn,
			quantity: update.quantity,
			warehouseId: update.warehouseId ? versionId(update.warehouseId) : this.noteType === "inbound" ? this.#w._id : ""
		};

		// Remove the matched transaction from the list of entries (this is the transaction we're updating to a new one)
		const entries = this.entries.filter((e) => !(e.isbn === matchTr.isbn && e.warehouseId === matchTr.warehouseId));

		// If both existing entries and entries without the match transaction are the same:
		// the match transaction wasn't found, exit early
		if (entries.length === this.entries.length) {
			return this.update({}, {}); // Noop update
		}

		// Check if there already is a transaction with the same 'isbn' and 'warehouseId' as the updated transaction.
		// If so, we're merging the two, if not we're simply adding a new transaction to the list.
		const existingTxnIx = entries.findIndex((e) => e.isbn === updateTr.isbn && e.warehouseId === updateTr.warehouseId);

		if (existingTxnIx == -1) {
			entries.push(updateTr);
		} else {
			entries[existingTxnIx] = {
				...entries[existingTxnIx],
				quantity: entries[existingTxnIx].quantity + updateTr.quantity
			};
		}

		// Post an update, the local entries will be updated by the update function.
		return this.update({}, { entries: entries.sort(sortBooks) });
	}

	removeTransactions(...transactions: Omit<VolumeStock, "quantity">[]): Promise<NoteInterface> {
		const removeTransaction = (transaction: Omit<VolumeStock, "quantity">) => {
			// If this is an inbound note, we infer the warehouse id from the note itself.
			// If this is an outbound note, we read the transaction's warehouse id, or falling back to an empty string (warhehouse not assigned).
			const wh = transaction.warehouseId ? versionId(transaction.warehouseId) : this.noteType === "inbound" ? this.#w._id : "";

			this.entries = this.entries.filter(({ isbn, warehouseId }) => isbn !== transaction.isbn || warehouseId !== wh);
		};

		transactions.forEach(removeTransaction);

		return this.update({}, this);
	}

	/**
	 * Commit the note, disabling further updates and deletions. Committing a note also accounts for note's transactions
	 * when calculating the stock of the warehouse.
	 */
	async commit(ctx: debug.DebugCtx, options?: { force: boolean }): Promise<NoteInterface> {
		debug.log(ctx, "note:commit")({});

		// Don't allow for committing of empty notes.
		// We're allowing commit if 'force === true' (this should only be used in tests)
		if (this.entries.length === 0 && !options?.force) {
			throw new EmptyNoteError();
		}

		// Check transactions before committing
		switch (this.noteType) {
			case "inbound": {
				// All transactions in an inbound note must be assigned to the same (note parent) warehouse.
				const invalidTransactions = this.entries.filter(({ warehouseId }) => warehouseId !== this.#w._id);
				if (invalidTransactions.length) {
					throw new TransactionWarehouseMismatchError(this.#w._id, invalidTransactions);
				}
				break;
			}
			case "outbound": {
				const stock = await this.#db.getStock();

				const invalidTransactions = this.entries
					.map(({ isbn, quantity, warehouseId }) => ({
						isbn,
						quantity,
						warehouseId,
						available: stock.isbn(isbn).get([isbn, warehouseId])?.quantity || 0
					}))
					// Filter out transactions that are valid
					.filter(({ quantity, available }) => quantity > available);

				if (invalidTransactions.length) {
					throw new OutOfStockError(invalidTransactions);
				}
			}
		}

		return this.update(ctx, { committed: true });
	}

	async getEntries(): Promise<Iterable<VolumeStockClient>> {
		const entries = await this.get().then((note) => note?.entries || []);
		const warehouses = await this.#db.getWarehouseList();
		return addWarehouseNames(entries, warehouses);
	}

	printReceipt(): Promise<string> {
		return this.#db.receipts().print(this);
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

			// Combine latest is like an rxjs equivalent of svelte derived stores with multiple sources.
			entries: (ctx: debug.DebugCtx, page = 0, itemsPerPage = 10): Observable<EntriesStreamResult> => {
				const startIx = page * itemsPerPage;
				const endIx = startIx + itemsPerPage;

				return combineLatest([
					this.#stream.pipe(
						map(
							({ entries = [] }): TableData => ({
								rows: entries
									.map((e) => ({ ...e, warehouseName: "" }))
									.sort(sortBooks)
									.slice(startIx, endIx),
								stats: { total: entries.length, totalPages: Math.ceil(entries.length / itemsPerPage) }
							})
						)
					),
					this.#db.stream().warehouseList(ctx),
					this.#db.stock()
				]).pipe(
					tap(debug.log(ctx, "note:entries:stream:input")),
					map(combineTransactionsWarehouses({ includeAvailableWarehouses: this.noteType === "outbound" })),
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

export const newNote = (w: WarehouseInterface, db: DatabaseInterface, id?: string): NoteInterface => {
	return new Note(w, db, id);
};
