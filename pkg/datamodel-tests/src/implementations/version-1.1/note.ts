import { BehaviorSubject, Observable } from 'rxjs';

import { DocType, NoteState, NoteType, VolumeStock, VolumeTransactionTuple } from '@librocco/db';

import { NoteInterface, WarehouseInterface, NoteData, DatabaseInterface } from './types';

import { runAfterCondition, sortBooks, uniqueTimestamp } from '@/utils/misc';
import { newDocumentStream } from '@/utils/pouchdb';

class Note implements NoteInterface {
	// We wish the warehouse back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#w: WarehouseInterface;
	#db: DatabaseInterface;

	#initialized = new BehaviorSubject(false);
	#exists = false;

	_id: string;
	docType = DocType.Note;
	_rev?: string;

	noteType: NoteType;

	entries: VolumeStock[] = [];
	committed = false;
	displayName = '';
	updatedAt = new Date().toISOString();

	constructor(warehouse: WarehouseInterface, db: DatabaseInterface, id?: string) {
		this.#w = warehouse;
		this.#db = db;

		// Outbound notes are assigned to the default warehouse, while inbound notes are assigned to a non-default warehouse
		this.noteType = warehouse._id === '0-all' ? 'outbound' : 'inbound';

		// If id not provided (we're creating a new note), generate a unique timestamp
		let tempId = id || uniqueTimestamp();
		// Validate id (it should either be a full '<warehouse-id>/<note-type>/<note-id>' id or a single segment, '<note-id>')
		const idSegments = tempId.split('/');
		if (![1, 3].includes(idSegments.length)) {
			throw new Error('Invalid note id: ' + tempId);
		}
		// If single segment id provided, add warehouse and note type
		if (idSegments.length === 1) {
			tempId = `${warehouse._id}/${this.noteType}/${tempId}`;
		}
		this._id = tempId;

		// If this is a new note, no need to check for DB, it should't exist, and unique timestamp as id
		// assures this id is not taken
		if (!id) {
			this.#initialized.next(true);
			return this;
		}

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

		return this;
	}

	/**
	 * Update field is a method for internal usage, used to update the local field, if the value is provided
	 */
	private updateField<K extends keyof NoteData>(field: K, value?: NoteData[K]) {
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
	private updateInstance(data: Partial<NoteData>): NoteInterface {
		// Update the data with provided fields
		this.updateField('_rev', data._rev);
		this.updateField('noteType', data.noteType);
		this.updateField('committed', data.committed);
		this.updateField('entries', data.entries);
		this.updateField('displayName', data.displayName);
		this.updateField('updatedAt', data.updatedAt);

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
			// For some reason we need to spread '...this' as otherwise the put method mutates the instance (for some reason).
			const { rev } = await this.#db._pouch.put<NoteData>({ ...this });
			return this.updateField('_rev', rev);
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
	private update(data: Partial<NoteInterface>) {
		return runAfterCondition(async () => {
			// Committed notes cannot be updated.
			if (this.committed) {
				return this;
			}
			const updatedData = { ...this, ...data };
			const { rev } = await this.#db._pouch.put<NoteData>(updatedData);
			return this.updateInstance({ ...updatedData, _rev: rev });
		}, this.#initialized);
	}

	/**
	 * Delete the note from the db.
	 */
	delete(): Promise<void> {
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
	setName(displayName: string): Promise<NoteInterface> {
		return this.update({ displayName });
	}

	/**
	 * Add volumes accepts a tuple update (isbn, quantity, warehouse) or an array of tuples (updates) for
	 * book quantities. If a volume with a given isbn is found, the quantity is aggregated, otherwise a new
	 * entry is pushed to the list of entries.
	 */
	addVolumes(...params: Parameters<NoteInterface['addVolumes']>): Promise<NoteInterface> {
		// A check to see if the update function should be ran once or multiple times
		const isTuple = (params: Parameters<NoteInterface['addVolumes']>): params is VolumeTransactionTuple => {
			return !Array.isArray(params[0]);
		};

		return runAfterCondition(async () => {
			const updateQuantity = (isbn: string, quantity: number, warehouse = this.#w._id) => {
				const matchIndex = this.entries.findIndex((entry) => entry.isbn === isbn && entry.warehouse === warehouse);

				if (matchIndex === -1) {
					this.entries.push({ isbn, warehouse, quantity });
					return;
				}

				this.entries[matchIndex] = {
					isbn,
					warehouse,
					quantity: this.entries[matchIndex].quantity + quantity
				};
			};

			if (isTuple(params)) {
				updateQuantity(params[0], params[1], params[2]);
			} else {
				params.forEach((update) => updateQuantity(update[0], update[1], update[2]));
			}

			return this.update(this);
		}, this.#initialized);
	}

	updateTransaction(transaction: VolumeStock): Promise<NoteInterface> {
		// Create a safe copy of volume entries
		const entries = [...this.entries];
		const i = entries.findIndex(({ isbn }) => isbn === transaction.isbn);
		// If the entry exists, update it, if not push it to the end of the list.
		if (i !== -1) {
			entries[i] = transaction;
		} else {
			entries.push(transaction);
		}
		// Post an update, the local entries will be updated by the update function.
		return this.update({ entries });
	}

	/**
	 * Commit the note, disabling further updates and deletions. Committing a note also accounts for note's transactions
	 * when calculating the stock of the warehouse.
	 */
	commit(): Promise<NoteInterface> {
		return this.update({ committed: true });
	}

	/**
	 * Create stream is a convenience method for internal usage, leveraging `newDocumentStream` to create a
	 * pouchdb changes stream for a specific property on a note, while abstracting away the details of the subscription
	 * such as the db and the note id as well as to abstract signature bolierplate (as document type is always `NoteData` and the
	 * observable signature type is inferred from the selector callback)
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private createStream<S extends (doc: PouchDB.Core.ChangesResponseChange<NoteData>) => any>(selector: S): Observable<ReturnType<S>> {
		return newDocumentStream<NoteData, ReturnType<S>>(this.#db._pouch, this._id, selector);
	}

	/**
	 * Creates streams for the note data. The streams are hot in a way that they will
	 * emit the value from external source (i.e. db), but cold in a way that the db subscription is
	 * initiated only when the stream is subscribed to (and canceled on unsubscribe).
	 */
	stream() {
		return {
			displayName: this.createStream((change) => {
				return change.doc?.displayName || '';
			}),
			entries: this.createStream((change) => (change.doc?.entries || []).sort(sortBooks)),
			/** @TODO update the data model to have 'state' */
			state: this.createStream((change) => (change.doc?.committed ? NoteState.Committed : NoteState.Draft)),
			updatedAt: this.createStream((change) => {
				// The date gets serialized as a string in the db, so we need to convert it back to a date object (if defined)
				const ua = change.doc?.updatedAt;
				return ua ? new Date(ua) : new Date();
			})
		};
	}
}

export const newNote = (w: WarehouseInterface, db: DatabaseInterface, id?: string): NoteInterface => {
	return new Note(w, db, id);
};
