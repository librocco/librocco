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

interface NoteProto {
	addVolumes(isbn: string, quantity: number): NoteEntry;
	setVolumeQuantity(isbn: string, quantity: number): NoteEntry;
	delete(): void;
	commit(): void;
}
interface Note extends NoteProto {
	_id: string;
	type: NoteType;
	warehouse: string;
}

export const newNote = (w: Warehouse<NoteEntry>, type: NoteType): NoteEntry => {
	const _id = randomUUID();

	const noteProto: NoteProto = {
		addVolumes(isbn, quantity) {
			const books = w.getNote(_id).books;
			if (books[isbn]) {
				books[isbn] += quantity;
			} else {
				books[isbn] = quantity;
			}
			return w.getNote(_id);
		},
		setVolumeQuantity(isbn, quantity) {
			w.getNote(_id).books[isbn] = quantity;
			return w.getNote(_id);
		},
		delete() {
			w.deleteNote(_id);
		},
		commit() {
			w.getNote(_id).commited = true;
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
	createInNote(): N & NoteProto;
	createOutNote(): N & NoteProto;
	deleteNote(_id: string): void;
	getNotes(): N[];
	getNote(id: string): N;
	getStock(): Volume[];
	name: string;
}
export const newWarehouse = (db: Database, name = 'default'): Warehouse<NoteEntry> => {
	const proto: Warehouse<NoteEntry> = {
		createInNote() {
			const n = newNote(this, 'inbound');
			db.setNotes({ ...db.getNotes(), [n._id]: n });
			return n;
		},
		createOutNote() {
			const n = newNote(this, 'outbound');
			db.setNotes({ ...db.getNotes(), [n._id]: n });
			return n;
		},
		deleteNote(_id) {
			const notes = db.getNotes();
			delete notes[_id];
			db.setNotes(notes);
		},
		getNotes() {
			return getNotesForWarehouse(db, this);
		},
		getNote(noteId: string) {
			return db.getNotes()[noteId];
		},
		getStock() {
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
		test('should add books to note', () => {
			const db = newDatabase(randomUUID());

			const scienceW = db.createWarehouse('science');
			scienceW
				.createInNote()
				.addVolumes('0001112222', 2)
				.addVolumes('0001112223', 3)
				.addVolumes('0001112223', 1)
				.commit();

			const scienceStock = scienceW.getStock();
			expect(scienceStock[0].quantity).toEqual(2);
			expect(scienceStock[1].quantity).toEqual(4);
		});

		test('should update the state with only commited notes', () => {
			const db = newDatabase(randomUUID());

			const scienceW = db.createWarehouse('science');
			const note1 = scienceW.createInNote().addVolumes('0001112222', 2);
			const note2 = scienceW.createInNote().addVolumes('0001112222', 3);

			let scienceStock = scienceW.getStock();

			// No note is yet committed so results should be 0
			expect(scienceStock.length).toEqual(0);

			note1.commit();
			// Only the quantity from the first note should be applied
			scienceStock = scienceW.getStock();
			expect(scienceStock[0].quantity).toEqual(2);

			note2.commit();
			scienceStock = scienceW.getStock();
			expect(scienceStock[0].quantity).toEqual(5);
		});

		test('outbound notes should decrement the book stock', () => {
			const db = newDatabase(randomUUID());

			const scienceW = db.createWarehouse('science');
			scienceW.createInNote().addVolumes('0001112222', 5).commit();
			scienceW.createOutNote().addVolumes('0001112222', 3).commit();

			const scienceStock = scienceW.getStock();
			expect(scienceStock[0].quantity).toEqual(2);
		});

		test('should be able to delete note(s)', () => {
			const db = newDatabase(randomUUID());

			const w = db.createWarehouse('wh');
			const note1 = w.createInNote();
			const note2 = w.createInNote();

			let notes = w.getNotes();
			expect(notes.length).toEqual(2);

			// Delete second note
			note2.delete();
			notes = w.getNotes();
			expect(notes.length).toEqual(1);
			expect(w.getNote(note1._id)).toBeTruthy();
			expect(w.getNote(note2._id)).toBeFalsy();
		});

		test('should be able to set books stock', () => {
			const db = newDatabase(randomUUID());

			const w = db.createWarehouse('wh');
			const note1 = w.createInNote().addVolumes('0001112222', 5);

			expect(w.getNote(note1._id).books['0001112222']).toEqual(5);

			note1.setVolumeQuantity('0001112222', 2);
			expect(w.getNote(note1._id).books['0001112222']).toEqual(2);
		});
	});
}
// #endregion tests
