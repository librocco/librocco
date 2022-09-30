import PouchDB from 'pouchdb';
import { default as MemoryAdapter } from 'pouchdb-adapter-memory';
import { randomUUID } from 'crypto';

import { WarehouseInterface } from './types-implementation';

import { newWarehouse } from './warehouse';

PouchDB.plugin(MemoryAdapter);

// #region standard_api
interface DatabaseProto {
	createWarehouse(name: string): WarehouseInterface;
}

type DatabaseInterface = DatabaseProto;
// #endregion standard_api

class Database implements DatabaseInterface {
	#db: PouchDB.Database;

	constructor(db: PouchDB.Database) {
		this.#db = db;
	}

	createWarehouse(name: string) {
		return newWarehouse(this.#db, name);
	}
}

export const newDatabase = (name: string): Database => {
	const db = new PouchDB(name, { adapter: 'memory' });
	return new Database(db);
};
// #region Database

// #region tests
const getDBName = () => ['.temp-testdb', randomUUID()].join('-');
if (import.meta.vitest) {
	const { describe, test, expect } = import.meta.vitest;
	describe('Test example implementation', () => {
		test.only('should add books to note', async () => {
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
