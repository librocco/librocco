import { randomUUID } from 'crypto';

import { VolumeStock, WarehouseData } from '@/types';
import { NoteData, NoteInterface, WarehouseInterface, DatabaseInterface } from './types';

import { newNote } from './note';

import { sortBooks } from '@/utils/misc';

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
		const n = newNote(this, {
			type: 'inbound',
			_id: [this.name, 'inbound', randomUUID()].join('/')
		});
		return this.updateNote(n);
	}

	async createOutNote() {
		const n = newNote(this, {
			type: 'outbound',
			_id: [this.name, 'outbound', randomUUID()].join('/')
		});
		return this.updateNote(n);
	}

	async getNotes(): Promise<NoteInterface[]> {
		return getNotesForWarehouse(this.#db, this);
	}

	async getNote(noteId: string): Promise<NoteInterface> {
		const noteData = (await this.#db._pouch.get(noteId)) as NoteData;
		return newNote(this, noteData);
	}

	deleteNote(note: NoteInterface) {
		return new Promise<void>((resolve, reject) => {
			this.#db._pouch.remove(note as Required<NoteInterface>, {}, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	async updateNote(note: NoteInterface) {
		const { rev } = await this.#db._pouch.put(note);
		return note.updateRev(rev);
	}

	async getStock(): Promise<VolumeStock[]> {
		return getStockForWarehouse(this.#db, this);
	}
}

export const newWarehouse = (db: DatabaseInterface, name: string): WarehouseInterface => {
	return new Warehouse(db, { name });
};

const getNotesForWarehouse = async (
	db: DatabaseInterface,
	w: WarehouseInterface
): Promise<NoteInterface[]> => {
	const query =
		w.name === 'default'
			? db._pouch.allDocs({
					include_docs: true
			  })
			: db._pouch.allDocs({
					startkey: `${w.name}/`,
					// All notes are prepended with warehouse name, like so "science/note-1"
					// This way we're reading from the first "science/" until (excluding) "science0"
					// "0" comes right after "/" aplhabetically
					endkey: `${w.name}0`,
					include_docs: true
			  });
	const res = await query;
	return res.rows.map(({ doc }) => newNote(w, doc as NoteData));
};

const getStockForWarehouse = async (db: DatabaseInterface, w: WarehouseInterface) => {
	const allNotes = await getNotesForWarehouse(db, db.warehouse());

	return allNotes
		.reduce((acc, { type, books, committed }) => {
			if (!committed) {
				return acc;
			}

			return books.reduce((acc, { isbn, warehouse, quantity }) => {
				if (![warehouse, 'default'].includes(w.name)) {
					return acc;
				}

				const delta = type == 'inbound' ? quantity : -quantity;
				const matchIndex = acc.findIndex(
					(b) => b.isbn === isbn && b.warehouse === warehouse
				);

				if (matchIndex == -1) {
					return [...acc, { isbn, warehouse, quantity: delta }];
				}

				acc[matchIndex].quantity += delta;
				return acc;
			}, acc);
		}, [] as VolumeStock[])
		.sort(sortBooks);
};
