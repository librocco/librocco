import { BehaviorSubject, combineLatest, map, Observable, tap } from 'rxjs';

import { debug } from '@librocco/shared';

import { DocType, NoteState } from '@/enums';

import { NoteType, VolumeStock, VersionedString, PickPartial } from '@/types';
import { NoteInterface, WarehouseInterface, NoteData, DatabaseInterface } from './types';

import { isVersioned, runAfterCondition, sortBooks, uniqueTimestamp, versionId } from '@/utils/misc';
import { newDocumentStream } from '@/utils/pouchdb';

class Note implements NoteInterface {
	// We wish the warehouse back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#w: WarehouseInterface;
	#db: DatabaseInterface;

	#initialized = new BehaviorSubject(false);
	#exists = false;

	_id: VersionedString;
	docType = DocType.Note;
	_rev?: string;

	noteType: NoteType;

	entries: VolumeStock[] = [];
	committed = false;
	displayName = '';
	updatedAt: string | null = null;

	constructor(warehouse: WarehouseInterface, db: DatabaseInterface, id?: string) {
		this.#w = warehouse;
		this.#db = db;

		// Outbound notes are assigned to the default warehouse, while inbound notes are assigned to a non-default warehouse
		this.noteType = warehouse._id === versionId('0-all') ? 'outbound' : 'inbound';

		// If id provided, validate it:
		// - it should either be a full id - 'v1/<warehouse-id>/<note-type>/<note-id>'
		// - or a single segment id - '<note-id>'
		if (id && ![1, 4].includes(id.split('/').length)) {
			throw new Error('Invalid note id: ' + id);
		}

		// Store the id internally:
		// - if id is a single segment id, prepend the warehouse id and note type, and version the string
		// - if id is a full id, assign it as is
		this._id = !id
			? versionId(`${warehouse._id}/${this.noteType}/${uniqueTimestamp()}`)
			: isVersioned(id) // If id is versioned, it's a full id, assign it as is
			? id
			: versionId(`${warehouse._id}/${this.noteType}/${id}`);

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
	private updateInstance(data: Partial<Omit<NoteData, '_id'>>): NoteInterface {
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

			const updatedAt = new Date().toISOString();

			const sequentialNumber = (await this.#db._pouch.query('sequence/note')).rows[0];
			const seqIndex = sequentialNumber ? sequentialNumber.value.max && ` (${sequentialNumber.value.max + 1})` : '';

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
	private update(data: Partial<NoteInterface>, ctx: debug.DebugCtx) {
		return runAfterCondition(async () => {
			debug.log(ctx, 'note:update')({ data });

			// Committed notes cannot be updated.
			if (this.committed) {
				debug.log(ctx, 'note:update:note_committed')(this);
				return this;
			}

			// If creating a note, we're also creating a warehouse. If the warehouse
			// already exists, this is a no-op anyhow.
			// No need to await this, as the warehouse is not needed for the note to function.
			this.#w.create();

			const updatedData = { ...this, ...data, updatedAt: new Date().toISOString() };
			debug.log(ctx, 'note:updating')({ updatedData });
			const { rev } = await this.#db._pouch.put<NoteData>(updatedData);
			debug.log(ctx, 'note:updated')({ updatedData, rev });

			// Update note itself
			return this.updateInstance({ ...updatedData, _rev: rev });
		}, this.#initialized);
	}

	/**
	 * Delete the note from the db.
	 */
	delete(ctx: debug.DebugCtx): Promise<void> {
		debug.log(ctx, 'note:delete')({});
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
	setName(displayName: string, ctx: debug.DebugCtx): Promise<NoteInterface> {
		const currentDisplayName = this.displayName;
		debug.log(ctx, 'note:set_name')({ displayName, currentDisplayName });

		if (displayName === currentDisplayName || !displayName) {
			debug.log(ctx, 'note:set_name:noop')({ displayName, currentDisplayName });
			return Promise.resolve(this);
		}

		debug.log(ctx, 'note:set_name:updating')({ displayName });
		return this.update({ displayName }, ctx);
	}

	/**
	 * Add volumes accepts an object or multiple objects of VolumeStock updates (isbn, quantity, warehouseId?) for
	 * book quantities. If a volume with a given isbn is found, the quantity is aggregated, otherwise a new
	 * entry is pushed to the list of entries.
	 */
	addVolumes(...params: Parameters<NoteInterface['addVolumes']>): Promise<NoteInterface> {
		return runAfterCondition(async () => {
			params.forEach((update) => {
				const warehouseId = this.noteType === 'inbound' ? this.#w._id : update.warehouseId ? versionId(update.warehouseId) : '';
				const matchIndex = this.entries.findIndex(
					(entry) => entry.isbn === update.isbn && entry.warehouseId === update.warehouseId
				);

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

			return this.update(this, {});
		}, this.#initialized);
	}

	updateTransaction(transaction: PickPartial<VolumeStock, 'warehouseId'>): Promise<NoteInterface> {
		// Create a safe copy of volume entries
		const entries = [...this.entries];

		const versionedTransaction = { ...transaction, warehouseId: transaction.warehouseId ? versionId(transaction.warehouseId) : '' };
		// handle edge case where we have multiple books with the same isbn, but belonging to different warehouses
		// match isbn only in case entry has no whId but transaction does (not undefined or empty string)
		const i = entries.findIndex(
			({ isbn, warehouseId }) =>
				isbn === versionedTransaction.isbn &&
				(warehouseId === versionedTransaction.warehouseId || (!warehouseId && transaction.warehouseId))
		);

		// If the entry exists, update it, if not push it to the end of the list.
		if (i !== -1) {
			entries[i] = versionedTransaction;
		} else {
			entries.push(versionedTransaction);
		}
		// Post an update, the local entries will be updated by the update function.
		return this.update({ entries }, {});
	}

	/**
	 * Commit the note, disabling further updates and deletions. Committing a note also accounts for note's transactions
	 * when calculating the stock of the warehouse.
	 */
	commit(ctx: debug.DebugCtx): Promise<NoteInterface> {
		debug.log(ctx, 'note:commit')({});
		return this.update({ committed: true }, ctx);
	}

	/**
	 * Create stream is a convenience method for internal usage, leveraging `newDocumentStream` to create a
	 * pouchdb changes stream for a specific property on a note, while abstracting away the details of the subscription
	 * such as the db and the note id as well as to abstract signature bolierplate (as document type is always `NoteData` and the
	 * observable signature type is inferred from the selector callback)
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private createStream<S extends (doc?: NoteData) => any>(selector: S, ctx: debug.DebugCtx): Observable<ReturnType<S>> {
		return newDocumentStream<NoteData, ReturnType<S>>(this.#db._pouch, this._id, selector, this, ctx);
	}

	/**
	 * Creates streams for the note data. The streams are hot in a way that they will
	 * emit the value from external source (i.e. db), but cold in a way that the db subscription is
	 * initiated only when the stream is subscribed to (and canceled on unsubscribe).
	 */
	stream(ctx: debug.DebugCtx) {
		return {
			displayName: this.createStream((doc) => {
				return doc?.displayName || '';
			}, ctx),

			// Combine latest is like an rxjs equivalent of svelte derived stores with multiple sources.
			entries: combineLatest([
				this.createStream((doc) => (doc?.entries || []).map((e) => ({ ...e, warehouseName: '' })).sort(sortBooks), ctx),
				this.#db.stream(ctx).warehouseList
			]).pipe(
				tap(debug.log(ctx, 'note:entries:stream:input')),
				map(([entries, warehouses]) => {
					// Create a record of warehouse ids and names for easy lookup
					const warehouseNames = warehouses.reduce((acc, { id, displayName }) => ({ ...acc, [id]: displayName }), {});
					// warehouseId always has a fallback value
					return entries.map((e) => ({ ...e, warehouseName: warehouseNames[e.warehouseId] || 'not-found' }));
				}),
				tap(debug.log(ctx, 'note:entries:stream:output'))
			),

			/** @TODO update the data model to have 'state' */
			state: this.createStream((doc) => (doc?.committed ? NoteState.Committed : NoteState.Draft), ctx),

			updatedAt: this.createStream((doc) => {
				// The date gets serialized as a string in the db, so we need to convert it back to a date object (if defined)
				const ua = doc?.updatedAt;
				return ua ? new Date(ua) : null;
			}, ctx)
		};
	}
}

export const newNote = (w: WarehouseInterface, db: DatabaseInterface, id?: string): NoteInterface => {
	return new Note(w, db, id);
};
