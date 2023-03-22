import { BehaviorSubject, combineLatest, map, Observable, tap } from 'rxjs';

import { debug } from '@librocco/shared';

import { DocType } from '@/enums';

import { VersionedString, VolumeStock, VolumeStockClient } from '@/types';

import { NEW_WAREHOUSE } from '@/constants';

import { NoteData, NoteInterface, WarehouseInterface, DatabaseInterface, WarehouseData } from './types';

import { newNote } from './note';
import { WarehouseStockEntry } from './designDocuments';

import { runAfterCondition, sortBooks, uniqueTimestamp, versionId } from '@/utils/misc';
import { newDocumentStream, newViewStream } from '@/utils/pouchdb';

class Warehouse implements WarehouseInterface {
	// We wish the db back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#db: DatabaseInterface;

	#initialized = new BehaviorSubject(false);
	#exists = false;

	_id: VersionedString;
	docType = DocType.Warehouse;
	_rev?: string;

	displayName = '';
	entries: VolumeStock[] = [];

	constructor(db: DatabaseInterface, id?: string | typeof NEW_WAREHOUSE) {
		this.#db = db;

		this._id = !id
			? // If id not provided, we're accessing the default warehouse
			  versionId('0-all')
			: // If NEW_WAREHOUSE sentinel provided, generate a new id
			id === NEW_WAREHOUSE
			? versionId(uniqueTimestamp())
			: // Run 'versionId' to ensure the id is versioned (if it already is versioned, it will be a no-op)
			  versionId(id);

		// If id provided, the note might or might not exist in the DB
		// perform a check and update the instance accordingly
		this.#db._pouch
			.get<NoteData>(this._id)
			// If note exists, populate the local instance with the data from db,
			// set the "exists" flag to true and mark the instance as initialized
			.then((res) => {
				this.updateInstance(res);
				this.#exists = true;
				this.#initialized.next(true);
			})
			// If note doesn't exist, mark the instance as initialized ('exists' is false by default)
			.catch(() => {
				this.#initialized.next(true);
			});
		this.#db = db;

		this.#db._pouch
			.get<WarehouseData>(this._id)
			// If warehouse exists, populate the local instance with the data from db,
			// set the "exists" flag to true and mark the instance as initialized
			.then((res) => {
				this.updateInstance(res);
				this.#exists = true;
				this.#initialized.next(true);
			})
			// If warehouse doesn't exist, mark the instance as initialized ('exists' is false by default)
			.catch(() => {
				this.#initialized.next(true);
			});
	}

	/**
	 * Update field is a method for internal usage, used to update the local field, if the value is provided
	 */
	private updateField<K extends keyof WarehouseData>(field: K, value?: WarehouseData[K]) {
		if (value !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this[field] = value as any;
		}
		this.#exists = true;
		return this;
	}

	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private updateInstance(data: Partial<Omit<WarehouseData, '_id'>>) {
		// Update the data with provided fields
		this.updateField('_rev', data._rev);
		this.updateField('displayName', data.displayName);
		this.updateField('entries', data.entries);

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
				const sequenceQuery = await this.#db._pouch.query('v1_sequence/warehouse');
				sequentialNumber = sequenceQuery.rows[0].value.max;
			} catch {
				//
			}
			const seqIndex = sequentialNumber ? ` (${sequentialNumber + 1})` : '';

			const initialValues = {
				...this,
				// If creating a default warehouse, we're initialising the 'displayName' as "All"
				displayName: this._id === versionId('0-all') ? 'All' : `New Warehouse${seqIndex}`
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((err as any).status === 404) return undefined;
			// For all other errors, throw
			throw err;
		}
	}

	/**
	 * Update is private as it's here for internal usage, while all updates to warehouse document
	 * from outside the instance have their own designated methods.
	 */
	private update(data: Partial<WarehouseData>): Promise<WarehouseInterface> {
		return runAfterCondition(async () => {
			const updatedData = { ...this, ...data };
			const { rev } = await this.#db._pouch.put(updatedData);
			return this.updateInstance({ ...this, _rev: rev });
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
			await this.#db._pouch.put({ ...this, _deleted: true } as Required<WarehouseInterface>);
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
	setName(displayName: string, ctx: debug.DebugCtx): Promise<WarehouseInterface> {
		const currentDisplayName = this.displayName;
		debug.log(ctx, 'note:set_name')({ displayName, currentDisplayName });

		if (displayName === currentDisplayName || !displayName) {
			debug.log(ctx, 'note:set_name:noop')({ displayName, currentDisplayName });
			return Promise.resolve(this);
		}

		debug.log(ctx, 'note:set_name:updating')({ displayName });
		return this.update({ displayName });
	}

	/**
	 * Create stream is a convenience method for internal usage, leveraging `newDocumentStream` to create a
	 * pouchdb changes stream for a specific property on a note, while abstracting away the details of the subscription
	 * such as the db and the note id as well as to abstract signature bolierplate (as document type is always `NoteData` and the
	 * observable signature type is inferred from the selector callback)
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private createStream<S extends (doc?: WarehouseData) => any>(selector: S, ctx: debug.DebugCtx): Observable<ReturnType<S>> {
		return newDocumentStream<WarehouseData, ReturnType<S>>(this.#db._pouch, this._id, selector, this, ctx);
	}

	/**
	 * Creates streams for the warehouse data. The streams are hot in a way that they will
	 * emit the value from external source (i.e. db), but cold in a way that the db subscription is
	 * initiated only when the stream is subscribed to (and canceled on unsubscribe).
	 */
	stream(ctx: debug.DebugCtx) {
		return {
			displayName: this.createStream((doc) => doc?.displayName || '', ctx),

			entries: combineLatest([
				newViewStream<{ rows: WarehouseStockEntry }, VolumeStockClient[]>(
					this.#db._pouch,
					'v1_stock/by_warehouse',
					{
						group_level: 2,
						...(this._id !== versionId('0-all') && {
							startkey: [this._id],
							endkey: [this._id, {}],
							include_end: true
						})
					},
					({ rows }) =>
						rows
							.map(({ key: [warehouseId, isbn], value: quantity }) => ({
								isbn,
								quantity,
								warehouseId,
								warehouseName: ''
							}))
							.filter(({ quantity }) => quantity > 0)
							.sort(sortBooks),
					ctx
				),
				this.#db.stream(ctx).warehouseList
			]).pipe(
				tap(debug.log(ctx, 'warehouse_entries:stream:input')),
				map(([entries, warehouses]) => {
					// Create a record of warehouse ids and names for easy lookup
					const warehouseNames = warehouses.reduce((acc, { id, displayName }) => ({ ...acc, [id]: displayName }), {});
					const res = entries.map((e) => ({
						...e,
						warehouseName: warehouseNames[e.warehouseId] || 'not-found'
					}));
					return res;
				}),
				tap(debug.log(ctx, 'warehouse_entries:stream:output'))
			)
		};
	}
}

export const newWarehouse = (db: DatabaseInterface, id?: string | typeof NEW_WAREHOUSE): WarehouseInterface => new Warehouse(db, id);