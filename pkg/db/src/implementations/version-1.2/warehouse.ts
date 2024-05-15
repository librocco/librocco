import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable, ReplaySubject, share, Subject, tap } from "rxjs";

import { debug, StockMap, wrapIter } from "@librocco/shared";

import { DocType } from "@/enums";

import { CouchDocument, EntriesStreamCsvResult, EntriesStreamResult, VersionedString, VolumeStockClient, VolumeStockCsv } from "@/types";
import { NoteInterface, WarehouseInterface, InventoryDatabaseInterface, WarehouseData, NoteData } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import { newNote } from "./note";
import { newStock } from "./stock";

import { addWarehouseName, versionId } from "./utils";
import { runAfterCondition, uniqueTimestamp, isEmpty, sortBooks, isBookRow, isCustomItemRow } from "@/utils/misc";
import { newDocumentStream } from "@/utils/pouchdb";
import { combineTransactionsWarehouses, addWarehouseData, TableData } from "./utils";

class Warehouse implements WarehouseInterface {
	// We wish the db back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#db: InventoryDatabaseInterface;

	#initialized = new BehaviorSubject(false);
	#exists = false;

	// Update stream receives the latest document (update) stream from the db. It's multicasted using plain RxJS Subject (no repeat or anything).
	// This stream is used to signal the update has happened (and has been streamed to update the instance). Subscribers needing to be notified when
	// an update happens should subscribe to this stream.
	#updateStream: Observable<WarehouseData>;
	// The stream is piped from the update stream, only it's multicasted using a ReplaySubject, which will cache the last value emitted by the stream,
	// for all new subscribers. Subscribers needing the latest (up-to-date) data and not needing to be notified when the NEXT update happened, should
	// subscribe to this stream.
	#stream: Observable<WarehouseData>;

	#stock: Observable<StockMap>;

	_id: VersionedString;
	docType = DocType.Warehouse;
	_rev?: string;
	_deleted?: boolean;

	displayName = "";
	discountPercentage = 0;

	constructor(db: InventoryDatabaseInterface, id?: string | typeof NEW_WAREHOUSE) {
		this.#db = db;

		this._id = !id
			? // If id not provided, we're accessing the default warehouse
			  versionId("0-all")
			: // If NEW_WAREHOUSE sentinel provided, generate a new id
			id === NEW_WAREHOUSE
			? versionId(uniqueTimestamp())
			: // Run 'versionId' to ensure the id is versioned (if it already is versioned, it will be a no-op)
			  versionId(id);

		const updateSubject = new Subject<WarehouseData>();
		// Create the internal document stream, which will be used to update the local instance on each change in the db.
		const cache = new ReplaySubject<WarehouseData>(1);
		this.#updateStream = newDocumentStream<WarehouseData>({}, this.#db._pouch, this._id).pipe(
			share({ connector: () => updateSubject, resetOnError: false, resetOnComplete: false, resetOnRefCountZero: false })
		);
		this.#stream = this.#updateStream.pipe(
			// We're connecting the stream to a ReplaySubject as a multicast object: this enables us to share the internal stream
			// with the exposed streams (displayName) and to cache the last value emitted by the stream: so that each subscriber to the stream
			// will get the 'initialValue' (repeated value from the latest stream).
			share({ connector: () => cache, resetOnError: false, resetOnComplete: false, resetOnRefCountZero: false })
		);

		const stockCache = new ReplaySubject<StockMap>(1);
		this.#stock = this.#db.stock().pipe(
			map((stock) => stock.warehouse(this._id)),
			share({ connector: () => stockCache, resetOnError: false, resetOnComplete: false, resetOnRefCountZero: false })
		);

		// The first value from the stream will be either warehouse data, or an empty object (if the warehouse doesn't exist in the db).
		// This is enough to signal that the warehouse intsance is initialised.
		firstValueFrom(this.#stream).then(() => this.#initialized.next(true));
		// If data is not empty (warehouse exists), setting of 'exists' flag is handled inside the 'updateInstance' method.
		this.#updateStream.subscribe((w) => this.updateInstance(w));
	}

	/**
	 * Update field is a method for internal usage, used to update the local field, if the value is provided
	 */
	private updateField<K extends keyof WarehouseData>(field: K, value?: WarehouseData[K]) {
		if (value !== undefined) {
			this[field] = value as any;
		}
		this.#exists = true;
		return this;
	}

	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private updateInstance(data: Partial<Omit<WarehouseData, "_id">>) {
		// No-op if the data is empty
		if (isEmpty(data)) {
			return this;
		}

		// Update the data with provided fields
		this.updateField("_rev", data._rev);
		this.updateField("displayName", data.displayName);
		this.updateField("discountPercentage", data.discountPercentage);

		this.#exists = true;

		return this;
	}

	/**
	 * If warehouse doesn't exist in the db, create an entry with initial values.
	 * No-op otherwise.
	 */
	create() {
		return runAfterCondition(async () => {
			if (this.#exists) {
				return this;
			}

			let sequentialNumber = 0;
			try {
				const sequenceQuery = await this.#db._pouch.query("v1_sequence/warehouse");
				sequentialNumber = sequenceQuery.rows[0].value.max;
			} catch {
				//
			}
			const seqIndex = sequentialNumber ? ` (${sequentialNumber + 1})` : "";

			const initialValues = {
				...this,
				// If creating a default warehouse, we're initialising the 'displayName' as "All"
				displayName: this._id === versionId("0-all") ? "All" : `New Warehouse${seqIndex}`
			};
			// Try and store the warehouse in the db
			try {
				const { rev } = await this.#db._pouch.put(initialValues);
				this.updateInstance({ ...initialValues, _rev: rev });
				return this;
				// This might sometimes fail as we might be running concurrent updates so
				// multiple instances of the same warehosue might write to the db: this will mostly happen in tests.
			} catch (err) {
				const res = this.get();
				// If no document found in the db, the error is something else, throw an error
				if (!res) {
					throw err;
				}
				return this;
			}
		}, this.#initialized);
	}

	/**
	 * Returns this warehouse instance, populated with the data from the db.
	 * If the warehouse doesn't exist in the db, returns `undefined`.
	 *
	 * We use this to explicitly ensure the instance is initialised (this is not needed for other methods, as they run after initialisation anyway).
	 * We can also use this to check if the warehouse exists in the db.
	 */
	async get() {
		try {
			const res = await this.#db._pouch.get(this._id);
			return this.updateInstance(res);
		} catch (err) {
			// If not found, return undefined
			if ((err as any).status === 404) return undefined;
			// For all other errors, throw
			throw err;
		}
	}

	/**
	 * Update is private as it's here for internal usage, while all updates to warehouse document
	 * from outside the instance have their own designated methods.
	 */
	private update(ctx: debug.DebugCtx, data: Partial<WarehouseData>): Promise<WarehouseInterface> {
		return runAfterCondition(async () => {
			const updatedData = { ...this, ...data };
			this.#db._pouch.put(updatedData);

			// We're waiting for the first value from stream (updating local instance) before resolving the
			// update promise.
			await firstValueFrom(this.#updateStream);
			return this;
		}, this.#initialized);
	}

	/**
	 * Delete the warehouse from the db.
	 * @TODO we still need to clarify what happens with the notes if warehouse gets deleted.
	 */
	delete(): Promise<void> {
		return runAfterCondition(async () => {
			if (!this.#exists) {
				return;
			}

			const docs = await this.#db._pouch
				.allDocs({
					startkey: versionId(""),
					endkey: versionId("").replace(/\/$/, "0"), // e.g. 'v10' (comes after 'v1/' -- this doesn't work for versions above 10, but we'll get to that if needed)
					include_docs: true
				})
				.then(({ rows }) => rows.filter(({ doc }) => !!doc).map(({ doc }) => doc as NoteData | WarehouseData))
				.catch((e) => (console.error(e), []));

			const docsToDelete = docs.flatMap((doc): CouchDocument[] => {
				// warehouse and inbound notes
				if (doc._id.startsWith(this._id)) {
					return [{ ...doc, _deleted: true }];
				}

				// outbound notes
				if (
					"noteType" in doc &&
					doc?.noteType === "outbound" &&
					doc?.entries.filter(isBookRow).some((entry) => entry.warehouseId === this._id)
				) {
					return [{ ...doc, entries: doc.entries.filter((entry) => isCustomItemRow(entry) || entry.warehouseId !== this._id) }];
				}

				// no need for update
				return [];
			});
			await this.#db._pouch.bulkDocs(docsToDelete);
		}, this.#initialized);
	}

	/**
	 * Instantiate a new note instance, with the provided id (used for both existing notes as well as new notes).
	 */
	note(id?: string): NoteInterface {
		return newNote(this, this.#db, id);
	}

	/**
	 * Update warehouse display name.
	 */
	setName(ctx: debug.DebugCtx, displayName: string): Promise<WarehouseInterface> {
		const currentDisplayName = this.displayName;
		debug.log(ctx, "note:set_name")({ displayName, currentDisplayName });

		if (displayName === currentDisplayName || !displayName) {
			debug.log(ctx, "note:set_name:noop")({ displayName, currentDisplayName });
			return Promise.resolve(this);
		}

		debug.log(ctx, "note:set_name:updating")({ displayName });
		return this.update({}, { displayName });
	}

	/**
	 * Update discount percentage
	 */
	setDiscount(ctx: debug.DebugCtx, discountPercentage: number): Promise<WarehouseInterface> {
		const currentDiscountPercentage = this.discountPercentage;
		debug.log(ctx, "note:set_discount_percentage")({ discountPercentage, currentDiscountPercentage });

		if (discountPercentage === currentDiscountPercentage || isNaN(discountPercentage)) {
			debug.log(ctx, "note:set_discount:noop")({ discountPercentage, currentDiscountPercentage });
			return Promise.resolve(this);
		}

		debug.log(ctx, "note:set_discount:updating")({ discountPercentage });
		return this.update({}, { discountPercentage });
	}

	async getEntries(): Promise<Iterable<VolumeStockClient>> {
		const [queryRes, warehouses] = await Promise.all([newStock(this.#db).query(), this.#db.getWarehouseDataMap()]);
		const entries = wrapIter(queryRes.rows())
			.filter(isBookRow)
			.filter(({ warehouseId }) => [versionId("0-all"), warehouseId].includes(this._id));
		return addWarehouseData(entries, warehouses);
	}

	async getCsvEntries(): Promise<Iterable<VolumeStockCsv>> {
		const [queryRes, warehouses] = await Promise.all([newStock(this.#db).query(), this.#db.getWarehouseDataMap()]);
		const entries = wrapIter(queryRes.rows())
			.filter(isBookRow)
			.filter(({ warehouseId }) => [versionId("0-all"), warehouseId].includes(this._id));
		return addWarehouseName(entries, warehouses);
	}

	/**
	 * Creates streams for the warehouse data. The streams are hot in a way that they will
	 * emit the value from external source (i.e. db), but cold in a way that the db subscription is
	 * initiated only when the stream is subscribed to (and canceled on unsubscribe).
	 */
	stream() {
		return {
			displayName: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "streams: display_name: input")),
					map(({ displayName }) => displayName || ""),
					tap(debug.log(ctx, "streams: display_name: res"))
				),

			discount: (ctx: debug.DebugCtx) =>
				this.#stream.pipe(
					tap(debug.log(ctx, "streams: discount: input")),
					map(({ discountPercentage }) => discountPercentage || 0),
					tap(debug.log(ctx, "streams: discount: res"))
				),

			entries: (ctx: debug.DebugCtx): Observable<EntriesStreamResult> => {
				const tableData = this.#stock.pipe(
					map(
						(stock): TableData => ({
							rows: [...stock.rows()].sort(sortBooks),
							total: stock.size
						})
					)
				);

				return combineLatest([tableData, this.#db.stream().warehouseMap(ctx)]).pipe(
					tap(debug.log(ctx, "warehouse_entries:stream:input")),
					map(combineTransactionsWarehouses({ includeAvailableWarehouses: false })),
					tap(debug.log(ctx, "warehouse_entries:stream:output"))
				);
			},
			entriesCsv: (ctx: debug.DebugCtx): Observable<EntriesStreamCsvResult> => {
				const tableData = this.#stock.pipe(
					map(
						(stock): TableData => ({
							rows: [...stock.rows()].sort(sortBooks),
							total: stock.size
						})
					)
				);

				return combineLatest([tableData, this.#db.stream().warehouseMap(ctx)]).pipe(
					tap(debug.log(ctx, "warehouse_entries_csv:stream:input")),
					map(([{ rows, total }, warehouses]) => ({
						total,
						rows: [...addWarehouseName(rows, warehouses)]
					})),
					tap(debug.log(ctx, "warehouse_entries_csv:stream:output"))
				);
			}
		};
	}
}

export const newWarehouse = (db: InventoryDatabaseInterface, id?: string | typeof NEW_WAREHOUSE): WarehouseInterface =>
	new Warehouse(db, id);
