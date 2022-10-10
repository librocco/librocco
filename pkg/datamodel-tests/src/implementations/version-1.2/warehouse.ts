import { VolumeStock, WarehouseData, CouchDocument, NoteBase, NoteType } from '@/types';
import { NoteInterface, WarehouseInterface, DatabaseInterface } from './types';
import { WarehouseStockEntry } from './designDocuments';

import { newNote } from './note';

import { unwrapDocs } from '@/utils/pouchdb';
import { sortBooks } from '@/utils/misc';
import { uniqueTimestamp } from './utils';

class Warehouse implements WarehouseInterface {
	// We wish the db back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#db: DatabaseInterface;

	name;

	constructor(db: DatabaseInterface, data: WarehouseData) {
		this.name = data.name;
		this.#db = db;
	}

	async createInNote() {
		const n = newNote(this, this.#db, {
			_id: newNoteId(this.name, 'inbound'),
			type: 'inbound'
		});
		return this.updateNote(n);
	}

	async createOutNote() {
		const n = newNote(this, this.#db, {
			_id: newNoteId(this.name, 'outbound'),
			type: 'outbound'
		});
		return this.updateNote(n);
	}

	async getNotes(): Promise<NoteInterface[]> {
		const res = await this.#db._pouch.query('warehouse/notes', {
			startkey: this.name,
			endkey: `${this.name}0`,
			include_docs: true
		});
		// The docs received are notes for warehouse with their corresponding volume transactions
		// sorted so that the note comes first, then all of the volume transactions for the note
		// followed by the next note and so on.
		const docs = unwrapDocs(res) as CouchDocument<NoteBase>[];

		return docs.map((n) => newNote(this, this.#db, n));
	}

	async getNote(noteId: string): Promise<NoteInterface> {
		const n = (await this.#db._pouch.get(noteId)) as CouchDocument<NoteBase>;
		return newNote(this, this.#db, n);
	}

	async deleteNote({ _id, _rev, transactions }: NoteInterface) {
		const deleteNoteSentinel = { _id, _rev, _deleted: true };
		const deleteTransactionsSentinels = transactions.map(([_id, _rev]) => ({
			_id,
			_rev,
			_deleted: true
		}));

		await this.#db._pouch.bulkDocs([deleteNoteSentinel, ...deleteTransactionsSentinels]);
	}

	async updateNote(note: NoteInterface) {
		const { rev } = await this.#db._pouch.put(note);
		return note.updateRev(rev);
	}

	async getStock(): Promise<VolumeStock[]> {
		const constraint =
			this.name === 'default'
				? {}
				: {
						startkey: [this.name],
						endkey: [`${this.name}0`]
				  };

		const res = await this.#db._pouch.query('warehouse/stock', {
			...constraint
		});

		// Reduce function aggregates all of the same [warehouse,isbn] entries.
		// @TODO: This should probably be done by reduce in the design document.
		return (res.rows as WarehouseStockEntry[])
			.reduce((acc, transaction) => {
				const [warehouse, isbn] = transaction.key;
				const delta = transaction.value;

				const last = acc.pop();

				// If first entry, return the entry
				if (!last) {
					return [{ isbn, quantity: delta, warehouse }];
				}
				// If the isbn and warehouse are the same as for the last entry, add the quantity
				if (last.isbn == isbn && last.warehouse == warehouse) {
					return [...acc, { ...last, quantity: last.quantity + delta }];
				}
				// Default, new isbn/warehouse pair, add the new element in the return array
				return [...acc, last, { isbn, quantity: delta, warehouse }];
			}, [] as VolumeStock[])
			.sort(sortBooks);
	}
}

export const newWarehouse = (db: DatabaseInterface, name: string): WarehouseInterface => {
	return new Warehouse(db, { name });
};

/**
 * Constructs and id for a note in form of '<warehouse_name>/<datetime_created>-<type>'.
 * This way we get convenient sorting:
 * - all notes are groupped by warehouse
 * - inter-warehouse notes are sorted by date of creation
 * - note type is included in the id so that the volume transactions belonging to the note
 * have access to note type (as volume transactions are prepended by note id).
 */
export const newNoteId = (wName: string, type: NoteType) =>
	[wName, type, uniqueTimestamp()].join('/');
