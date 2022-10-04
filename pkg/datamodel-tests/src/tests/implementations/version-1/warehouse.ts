import { randomUUID } from 'crypto';

import { VolumeStock, WarehouseData } from '@/types';
import { NoteData, NoteInterface, WarehouseInterface } from './types';

import { newNote } from './note';

type Database = PouchDB.Database;

class Warehouse implements WarehouseInterface {
	// We wish the db back-reference to be "invisible" when printing, serializing JSON, etc.
	// Prepending the property with "#" achieves the desired result by making the property non-enumerable.
	#db: Database;

	name;

	constructor(db: Database, data: WarehouseData) {
		this.name = data.name;
		this.#db = db;
	}

	async createInNote() {
		const n = newNote(this, {
			type: 'inbound',
			_id: [this.name, 'inbound', randomUUID()].join('/')
		});
		await this.#db.put(n);
		return n;
	}

	async createOutNote() {
		const n = newNote(this, {
			type: 'outbound',
			_id: [this.name, 'outbound', randomUUID()].join('/')
		});
		this.#db.put(n);
		return n;
	}

	async getNotes(): Promise<NoteInterface[]> {
		return getNotesForWarehouse(this.#db, this);
	}

	async getNote(noteId: string): Promise<NoteInterface> {
		const noteData = (await this.#db.get(noteId)) as NoteData;
		return newNote(this, noteData);
	}

	deleteNote(note: NoteInterface) {
		return new Promise<void>((resolve, reject) => {
			this.#db.remove(note, {}, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	async updateNote(note: NoteInterface) {
		await this.#db.put(note);
		return note;
	}

	async getStock(): Promise<VolumeStock[]> {
		return getStockForWarehouse(this.#db, this);
	}
}

export const newWarehouse = (db: Database, name: string): WarehouseInterface => {
	return new Warehouse(db, { name });
};

const getNotesForWarehouse = async (
	db: Database,
	w: WarehouseInterface
): Promise<NoteInterface[]> => {
	const query =
		w.name === 'default'
			? db.allDocs({
					include_docs: true
			  })
			: db.allDocs({
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

const getStockForWarehouse = async (db: Database, w: WarehouseInterface) => {
	const notes = await getNotesForWarehouse(db, w);
	const stockObj: Record<string, number> = {};
	notes.forEach(({ committed, books, type }) => {
		if (!committed) return;
		Object.entries(books).forEach(([isbn, q]) => {
			// We're using a volume quatity as a change to final quantity
			// increment for inbound notes, decrement for outbound
			const delta = type === 'outbound' ? -q : q;
			if (!stockObj[isbn]) {
				stockObj[isbn] = delta;
				return;
			}
			stockObj[isbn] += delta;
		});
	});
	return Object.entries(stockObj)
		.map(([isbn, quantity]) => ({
			isbn,
			quantity
		}))
		.sort((a, b) => (a.isbn < b.isbn ? -1 : 1));
};
