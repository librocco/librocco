import { randomUUID } from 'crypto';

import { WarehouseData } from './types';
import { NoteData, NoteInterface, WarehouseInterface } from './types-implementation';

import { newNote } from './note';

type Database = PouchDB.Database;

class Warehouse implements WarehouseInterface {
	private _db;

	name;

	constructor(db: Database, data: WarehouseData) {
		this._db = db;

		this.name = data.name;
	}

	async createInNote() {
		const n = newNote(this, {
			type: 'inbound',
			_id: [this.name, 'inbound', randomUUID()].join('/')
		});
		// await this._db.put(n);
		return n;
	}

	async createOutNote() {
		const n = newNote(this, {
			type: 'outbound',
			_id: [this.name, 'outbound', randomUUID()].join('/')
		});
		this._db.put(n);
		return n;
	}

	async getNotes() {
		return getNotesForWarehouse(this._db, this);
	}

	async getNote(noteId: string): Promise<NoteInterface> {
		const noteData = (await this._db.get(noteId)) as NoteData;
		return newNote(this, noteData);
	}

	deleteNote(note: NoteInterface) {
		return new Promise<void>((resolve, reject) => {
			this._db.remove(note, {}, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	async updateNote(note: NoteInterface) {
		await this._db.put(note);
		return note;
	}

	async getStock() {
		return getStockForWarehouse(this._db, this);
	}
}

export const newWarehouse = (db: Database, name = 'default'): Warehouse => {
	return new Warehouse(db, { name });
};

const getNotesForWarehouse = async (db: Database, w: Warehouse): Promise<NoteInterface[]> => {
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

const getStockForWarehouse = async (db: Database, w: Warehouse) => {
	const notes = await getNotesForWarehouse(db, w);
	const stockObj: Record<string, number> = {};
	notes.forEach(({ committed, books, type }) => {
		if (!committed) return;
		books.forEach(({ isbn, quantity: q }) => {
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
