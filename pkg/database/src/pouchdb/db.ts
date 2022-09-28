import { randomUUID } from 'crypto';

interface NoteEntry extends Note {
	books: Record<string, number>;
	commited: boolean;
}

const inMemDB: Record<
	string,
	{
		notes: Record<string, NoteEntry>;
	}
> = {};

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
	commit(): Promise<void>;
}
interface Note extends NoteProto {
	_id: string;
	type: NoteType;
	warehouse: string;
}

export const newNote = (w: Warehouse<NoteEntry>, type: NoteType): NoteEntry => {
	const _id = randomUUID();

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
				return w.getNote(_id);
			}

			params.forEach((update) => updateQuantity(...(update as VolumeQuantityTuple)));
			return w.getNote(_id);
		},
		async setVolumeQuantity(isbn, quantity) {
			const n = await w.getNote(_id);
			n.books[isbn] = quantity;
			return w.getNote(_id);
		},
		async delete() {
			w.deleteNote(_id);
		},
		async commit() {
			const n = await w.getNote(_id);
			n.commited = true;
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
const getNotesForWarehouse = (db: Database, w: Warehouse<NoteEntry>) =>
	w.name === 'default'
		? Object.values(db.getNotes())
		: Object.values(db.getNotes()).filter(({ warehouse }) => warehouse === w.name);

const getStockForWarehouse = (db: Database, w: Warehouse<NoteEntry>) => {
	const notes = getNotesForWarehouse(db, w);
	const stockObj: Record<string, number> = {};
	notes.forEach(({ books, commited, type }) => {
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
	deleteNote(_id: string): Promise<void>;
	getNotes(): Promise<N[]>;
	getNote(id: string): Promise<N>;
	getStock(): Promise<Volume[]>;
	name: string;
}
export const newWarehouse = (db: Database, name = 'default'): Warehouse<NoteEntry> => {
	const proto: Warehouse<NoteEntry> = {
		async createInNote() {
			const n = newNote(this, 'inbound');
			db.setNotes({ ...db.getNotes(), [n._id]: n });
			return n;
		},
		async createOutNote() {
			const n = newNote(this, 'outbound');
			db.setNotes({ ...db.getNotes(), [n._id]: n });
			return n;
		},
		async deleteNote(_id) {
			const notes = db.getNotes();
			delete notes[_id];
			db.setNotes(notes);
		},
		async getNotes() {
			return getNotesForWarehouse(db, this);
		},
		async getNote(noteId: string) {
			return db.getNotes()[noteId];
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
	// This is kinda TEMP
	setNotes(notes: Record<string, NoteEntry>): void;
	getNotes(): Record<string, NoteEntry>;
}
export const newDatabase = (name: string): Database => {
	inMemDB[name] = {
		notes: {}
	};
	const db = inMemDB[name];
	const proto: Database = {
		setNotes(notes) {
			db.notes = notes;
		},
		getNotes() {
			return db.notes;
		},
		createWarehouse(name) {
			return newWarehouse(this, name);
		}
	};

	return Object.assign(Object.create(proto), proto);
};
// #region Database

// #region tests
if (import.meta.vitest) {
	const { describe, test, expect } = import.meta.vitest;
	describe('Test in-memory implementation', () => {
		test('should add books to note', async () => {
			const db = newDatabase(randomUUID());

			const w = db.createWarehouse('science');
			const note = await w.createInNote();

			await note.addVolumes(['0001112222', 2], ['0001112223', 3], ['0001112223', 1]);
			await note.commit();

			const scienceStock = await w.getStock();
			expect(scienceStock[0].quantity).toEqual(2);
			expect(scienceStock[1].quantity).toEqual(4);
		});

		test('should update the state with only commited notes', async () => {
			const db = newDatabase(randomUUID());

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
			const db = newDatabase(randomUUID());

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
			const db = newDatabase(randomUUID());

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
			expect(await w.getNote(note2._id)).toBeFalsy();
		});

		test('should be able to set books stock', async () => {
			const db = newDatabase(randomUUID());

			const w = db.createWarehouse('wh');
			const note1 = await w.createInNote();
			await note1.addVolumes('0001112222', 5);

			let noteFromDB = await w.getNote(note1._id);
			expect(noteFromDB.books['0001112222']).toEqual(5);

			note1.setVolumeQuantity('0001112222', 2);
			noteFromDB = await w.getNote(note1._id);
			expect(noteFromDB.books['0001112222']).toEqual(2);
		});
	});
}
// #endregion tests
