import PouchDB from 'pouchdb';
import { randomUUID } from 'crypto';

interface NoteEntry extends Note {
	_id: string;
	_rev: string;
	books: Record<string, number>;
	commited: boolean;
}

// #region BookStock
interface Volume {
	isbn: string;
	quantity: number;
}
// #endregion BookStock

// #region Note
type NoteType = 'inbound' | 'outbound';

type VolumeQuantityTuple = [string, number];

interface NoteProto {
	addVolumes(...params: VolumeQuantityTuple): Promise<NoteEntry>;
	addVolumes(...params: VolumeQuantityTuple[]): Promise<NoteEntry>;
	setVolumeQuantity(isbn: string, quantity: number): Promise<NoteEntry>;
	delete(): Promise<void>;
	commit(): Promise<NoteEntry>;
}
interface Note extends NoteProto {
	_id: string;
	type: NoteType;
	warehouse: string;
}

export const newNote = (
	db: PouchDB.Database,
	w: Warehouse<NoteEntry>,
	type: NoteType
): NoteEntry => {
	const randId = randomUUID();
	const _id = [w.name, randId].join('/');

	const noteProto: NoteProto = {
		async addVolumes(...params) {
			const n = await w.getNote(_id);
			const books = n.books;

			const updateQuantity = (isbn: string, quantity: number) => {
				if (books[isbn]) {
					books[isbn] += quantity;
				} else {
					books[isbn] = quantity;
				}
			};

			if (typeof params[0] == 'string') {
				updateQuantity(...(params as VolumeQuantityTuple));
			} else {
				params.forEach((update) => updateQuantity(...(update as VolumeQuantityTuple)));
			}

			await w.updateNote(n);
			return n;
		},
		async setVolumeQuantity(isbn, quantity) {
			const n = await w.getNote(_id);
			n.books[isbn] = quantity;
			await w.updateNote(n);
			return n;
		},
		async delete() {
			const n = await w.getNote(_id);
			w.deleteNote(n);
		},
		async commit() {
			let n = await w.getNote(_id);
			n = { ...n, commited: true };
			await db.put(n);
			return n;
		}
	};

	const note = Object.assign(Object.create(noteProto) as typeof noteProto, {
		_id,
		type,
		warehouse: w.name,
		commited: false,
		books: {}
	});

	return Object.assign(note, Object.create(noteProto));
};
// #endregion Note

// #region Warehouse
const getNotesForWarehouse = async (
	db: PouchDB.Database,
	w: Warehouse<NoteEntry>
): Promise<NoteEntry[]> => {
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
	return res.rows.map(({ doc }) => doc as NoteEntry);
};

const getStockForWarehouse = async (db: PouchDB.Database, w: Warehouse<NoteEntry>) => {
	const notes = await getNotesForWarehouse(db, w);
	const stockObj: Record<string, number> = {};
	notes.forEach(({ commited, books, type }) => {
		if (!commited) return;
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

interface Warehouse<N extends Note = Note> {
	createInNote(): Promise<N>;
	createOutNote(): Promise<N>;
	getNotes(): Promise<N[]>;
	getNote(id: string): Promise<N>;
	updateNote(note: NoteEntry): Promise<N>;
	deleteNote(note: NoteEntry): Promise<void>;
	getStock(): Promise<Volume[]>;
	name: string;
}
export const newWarehouse = (db: PouchDB.Database, name = 'default'): Warehouse<NoteEntry> => {
	const proto: Warehouse<NoteEntry> = {
		async createInNote() {
			const n = newNote(db, this, 'inbound');
			db.put(n);
			return n;
		},
		async createOutNote() {
			const n = newNote(db, this, 'outbound');
			db.put(n);
			return n;
		},
		async getNotes() {
			return getNotesForWarehouse(db, this);
		},
		getNote(noteId: string) {
			return db.get(noteId);
		},
		async deleteNote(note) {
			return new Promise((resolve, reject) => {
				db.remove(note, {}, (err) => {
					if (err) {
						return reject(err);
					}
					return resolve();
				});
			});
		},
		async updateNote(note) {
			await db.put(note);
			return note;
		},
		async getStock() {
			return getStockForWarehouse(db, this);
		},
		name
	};
	return Object.create(proto);
};
// #endregion Warehouse

// #region Database
interface Database {
	createWarehouse(name: string): Warehouse<NoteEntry>;
	db: PouchDB.Database;
}
export const newDatabase = (name: string): Database => {
	const db = new PouchDB(name);

	const proto: Database = {
		createWarehouse(name) {
			return newWarehouse(db, name);
		},
		db
	};

	return Object.assign(Object.create(proto), proto);
};
// #region Database

// #region tests
const getDBName = () => ['.temp-testdb', randomUUID()].join('-');
if (import.meta.vitest) {
	const { describe, test, expect } = import.meta.vitest;
	describe('Test example implementation', () => {
		test('should add books to note', async () => {
			const db = newDatabase(getDBName());

			const w = db.createWarehouse('science');
			const note = await w.createInNote();

			await note.addVolumes(['0001112222', 2], ['0001112223', 3], ['0001112223', 1]);
			await note.commit();

			const scienceStock = await w.getStock();
			expect(scienceStock[0].quantity).toEqual(2);
			expect(scienceStock[1].quantity).toEqual(4);
		});

		test('should update the state with only commited notes', async () => {
			const db = newDatabase(getDBName());

			const scienceW = db.createWarehouse('science');
			const note1 = await scienceW.createInNote();
			await note1.addVolumes('0001112222', 2);

			const note2 = await scienceW.createInNote();
			await note2.addVolumes('0001112222', 3);

			let scienceStock = await scienceW.getStock();

			// No note is yet committed so results should be 0
			expect(scienceStock.length).toEqual(0);

			await note1.commit();
			// Only the quantity from the first note should be applied
			scienceStock = await scienceW.getStock();
			expect(scienceStock[0].quantity).toEqual(2);

			await note2.commit();
			scienceStock = await scienceW.getStock();
			expect(scienceStock[0].quantity).toEqual(5);
		});

		test('outbound notes should decrement the book stock', async () => {
			const db = newDatabase(getDBName());

			const scienceW = db.createWarehouse('science');
			const n1 = await scienceW.createInNote();
			await n1.addVolumes('0001112222', 5);
			await n1.commit();

			const n2 = await scienceW.createOutNote();
			await n2.addVolumes('0001112222', 3);
			await n2.commit();

			const scienceStock = await scienceW.getStock();
			expect(scienceStock[0].quantity).toEqual(2);
		});

		test('should be able to delete note(s)', async () => {
			const db = newDatabase(getDBName());

			const w = db.createWarehouse('wh');
			const note1 = await w.createInNote();
			const note2 = await w.createInNote();

			let notes = await w.getNotes();
			expect(notes.length).toEqual(2);

			// Delete second note
			await note2.delete();
			notes = await w.getNotes();
			expect(notes.length).toEqual(1);
			expect(await w.getNote(note1._id)).toBeTruthy();
			await expect(w.getNote(note2._id)).rejects.toThrow();
		});

		test('should be able to set books stock', async () => {
			const db = newDatabase(getDBName());

			const w = db.createWarehouse('wh');
			const note1 = await w.createInNote();
			await note1.addVolumes('0001112222', 5);

			let noteFromDB = await w.getNote(note1._id);
			expect(noteFromDB.books['0001112222']).toEqual(5);

			await note1.setVolumeQuantity('0001112222', 2);
			noteFromDB = await w.getNote(note1._id);
			expect(noteFromDB.books['0001112222']).toEqual(2);
		});
	});
}
// #endregion tests
