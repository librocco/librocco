import { randomUUID } from 'crypto';

import { VolumeStock, WarehouseData } from '@/types';
import {
	NoteData,
	NoteInterface,
	WarehouseInterface,
	DatabaseInterface,
	VolumesByISBN
} from './types';

import { newNote } from './note';

import { sortBooks } from '@/utils/misc';
import { addVolumeWarehouseQuantityToStock } from './utils';

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

const getStockForWarehouse = async (db: DatabaseInterface, warehouse: WarehouseInterface) => {
	const allNotes = await getNotesForWarehouse(db, db.warehouse());

	// Populate the stock object from the volume transactions found in notes
	const stockObj: VolumesByISBN = allNotes.reduce((fullStock, { committed, books, type }) => {
		// If note not commited, skip
		if (!committed) return fullStock;

		return Object.entries(books).reduce((noteStock, [isbn, quantityPerWarehouse]) => {
			// If warehouse "default" we're requesting an entire stock
			if (warehouse.name == 'default') {
				return Object.entries(quantityPerWarehouse).reduce((isbnStock, [w, q]) => {
					const delta = type === 'outbound' ? -q : q;
					return addVolumeWarehouseQuantityToStock(isbnStock, isbn, w, delta);
				}, noteStock);
			}

			// If warehouse anything other than the default, update the quantity only with
			// transactions to the same warehouse (if any exists in this node, for this isbn and this warehouse)
			const q = quantityPerWarehouse[warehouse.name];
			if (!q) return noteStock;

			const delta = type === 'outbound' ? -q : q;
			return addVolumeWarehouseQuantityToStock(noteStock, isbn, warehouse.name, delta);
		}, fullStock);
	}, {} as VolumesByISBN);

	// Return the stock object transformed to standardised list of VolumeStock
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
