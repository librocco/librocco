import { randomUUID } from 'crypto';

import { VolumeStock, WarehouseData, CouchDocument, NoteBase } from '@/types';
import { NoteData, NoteInterface, WarehouseInterface, DatabaseInterface } from './types';
import { WarehouseStockEntry } from './designDocuments';

import { newNote } from './note';

import { unwrapDocs } from '@/utils/pouchdb';

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
		const res = await this.#db._pouch.allDocs({
			startkey: this.name,
			endkey: `${this.name}0`,
			include_docs: true
		});
		// The docs received are notes for warehouse with their corresponding volume transactions
		// sorted so that the note comes first, then all of the volume transactions for the note
		// followed by the next note and so on.
		const docs = unwrapDocs(res) as (CouchDocument<NoteBase> | CouchDocument<VolumeStock>)[];

		return aggregateNotes(this, docs);
	}

	async getNote(noteId: string): Promise<NoteInterface> {
		const res = await this.#db._pouch.allDocs({
			startkey: noteId,
			endkey: `${noteId}0`,
			include_docs: true
		});
		// First document from the query will be the note entry itself e.g. for 'science/note-001'
		// first doc is 'note-001' while volume transactions for the note are 'science/note-001/<isbn>/<warehouse>'
		const [note, ...books] = unwrapDocs(res) as [
			CouchDocument<Pick<NoteInterface, 'committed' | 'type'>>,
			...CouchDocument<VolumeStock>[]
		];
		return newNote(this, { ...note, books });
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
		const res = await this.#db._pouch.query('stock/by_warehouse', {
			startkey: this.name,
			endkey: `${this.name}0`
		});

		// Reduce function aggregates all of the same [warehouse,isbn] entries.
		// @TODO: This should probably be done by reduce in the design document.
		return (res.rows as WarehouseStockEntry[]).reduce((acc, transaction) => {
			const isbn = transaction.key[1];
			const delta = transaction.value;

			const [last] = acc.splice(-1);

			if (last.isbn != isbn) {
				return [...acc, last, { isbn, quantity: delta, warehouse: this.name }];
			}
			return [...acc, { ...last, quantity: last.quantity + delta }];
		}, [] as VolumeStock[]);
	}
}

export const newWarehouse = (db: DatabaseInterface, name: string): WarehouseInterface => {
	return new Warehouse(db, { name });
};

const aggregateNotes = (
	w: WarehouseInterface,
	docs: (CouchDocument<NoteBase> | CouchDocument<VolumeStock>)[]
): NoteInterface[] => {
	const noteData = docs.reduce((acc, doc) => {
		if (doc['type']) {
			return [...acc, { ...doc, books: [] } as NoteData];
		}
		const [note] = acc.splice(-1) as [NoteData];
		const books = note.books || [];
		return [...acc, { ...note, books: [...books, doc as CouchDocument<VolumeStock>] }];
	}, [] as NoteData[]);

	return noteData.map((d) => newNote(w, d));
};
