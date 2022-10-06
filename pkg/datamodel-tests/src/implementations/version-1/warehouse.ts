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
		await this.#db._pouch.put(n);
		return n;
	}

	async createOutNote() {
		const n = newNote(this, {
			type: 'outbound',
			_id: [this.name, 'outbound', randomUUID()].join('/')
		});
		this.#db._pouch.put(n);
		return n;
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
			this.#db._pouch.remove(note, {}, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	async updateNote(note: NoteInterface) {
		await this.#db._pouch.put(note);
		return note;
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

const getStockForWarehouse = async (db: DatabaseInterface, warehouse: WarehouseInterface) => {
	const allNotes = await getNotesForWarehouse(db, db.warehouse());
	const stockObj: Record<string, Record<string, number>> = {};
	allNotes.forEach(({ committed, books, type }) => {
		if (!committed) return;
		Object.entries(books).forEach(([isbn, { quantity: q, warehouse: w }]) => {
			// Don't account for the volume entry if it doesn't belong to this warehouse
			// unless we're getting the full stock (default warehouse)
			if (warehouse.name !== 'default' && w != warehouse.name) return;
			// We're using a volume quatity as a change to final quantity
			// increment for inbound notes, decrement for outbound
			const delta = type === 'outbound' ? -q : q;
			if (!stockObj[isbn]) {
				stockObj[isbn] = { [w]: delta };
				return;
			}
			if (!stockObj[isbn][w]) {
				stockObj[isbn][w] = delta;
				return;
			}
			stockObj[isbn][w] += delta;
		});
	});
	return Object.entries(stockObj)
		.reduce((acc, [isbn, quantitiesPerWarehouse]) => {
			const allISBNCopies = Object.entries(quantitiesPerWarehouse).map(([warehouse, quantity]) => ({
				isbn,
				quantity,
				warehouse
			}));
			return [...acc, ...allISBNCopies];
		}, [] as { isbn: string; quantity: number; warehouse: string }[])
		.sort(sortBooks);
};
