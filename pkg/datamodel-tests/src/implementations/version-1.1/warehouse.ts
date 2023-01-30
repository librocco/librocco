import { BehaviorSubject, Observable } from 'rxjs';

import { DocType, VersionedString, VolumeStock } from '@librocco/db';

import { NoteData, NoteInterface, WarehouseInterface, DatabaseInterface, WarehouseData } from './types';

import { newNote } from './note';
import { WarehouseStockEntry } from './designDocuments';

import { isVersioned, runAfterCondition, sortBooks, versionId } from '@/utils/misc';
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

	displayName?: string;
	entries: VolumeStock[] = [];

	constructor(db: DatabaseInterface, id?: string) {
		this.#db = db;

		// If id not provided, we're accessing the default warehouse
		// If the provided id is not versioned,version it
		this._id = !id ? versionId('0-all') : isVersioned(id) ? id : versionId(id);

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
			const initialValues = {
				...this,
				// If creating a default warehouse, we're initialising the 'displayName' as "All"
				displayName: this._id === versionId('0-all') ? 'All' : ''
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
	setName(displayName: string): Promise<WarehouseInterface> {
		return this.update({ displayName });
	}

	/**
	 * Create stream is a convenience method for internal usage, leveraging `newDocumentStream` to create a
	 * pouchdb changes stream for a specific property on a note, while abstracting away the details of the subscription
	 * such as the db and the note id as well as to abstract signature bolierplate (as document type is always `NoteData` and the
	 * observable signature type is inferred from the selector callback)
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private createStream<S extends (doc: PouchDB.Core.ChangesResponseChange<WarehouseData>) => any>(
		selector: S
	): Observable<ReturnType<S>> {
		return newDocumentStream<WarehouseData, ReturnType<S>>(this.#db._pouch, this._id, selector);
	}

	/**
	 * Creates streams for the warehouse data. The streams are hot in a way that they will
	 * emit the value from external source (i.e. db), but cold in a way that the db subscription is
	 * initiated only when the stream is subscribed to (and canceled on unsubscribe).
	 */
	stream() {
		return {
			displayName: this.createStream((change) => change.doc?.displayName || ''),
			entries: newViewStream<{ rows: WarehouseStockEntry }, VolumeStock[]>(
				this.#db._pouch,
				'warehouse/stock',
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
						.map(({ key: [warehouseId, isbn], value: quantity }) => ({ isbn, quantity, warehouseId }))
						.filter(({ quantity }) => quantity > 0)
						.sort(sortBooks)
			)
		};
	}
}

export const newWarehouse = (db: DatabaseInterface, id?: string): WarehouseInterface => new Warehouse(db, id);
