/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'vitest';

import { TestFunction, VolumeQuantityTuple } from '@/types';

// Base functionality
export const deleteNotes: TestFunction = async (db) => {
	const w = db.warehouse('wh');
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
};

export const explicitlySetVolumeStock: TestFunction = async (db) => {
	const w = db.warehouse('wh');
	const note1 = await w.createInNote();
	await note1.addVolumes('0001112222', 5);

	let noteFromDB = await w.getNote(note1._id);
	expect(noteFromDB.books['0001112222']).toEqual(5);

	await note1.setVolumeQuantity('0001112222', 2);
	noteFromDB = await w.getNote(note1._id);
	expect(noteFromDB.books['0001112222']).toEqual(2);
};

export const getFullStock: TestFunction = async (db) => {
	const science = db.warehouse('science');
	const horses = db.warehouse('horses');

	const n1 = await science.createInNote();
	await n1.addVolumes('0123456789', 5);
	await n1.commit();

	const n2 = await horses.createInNote();
	await n2.addVolumes('0123456789', 2);
	await n2.commit();

	const scienceStock = await science.getStock();
	const horsesStock = await horses.getStock();
	const fullStock = await db.warehouse().getStock();

	expect(scienceStock).toEqual([{ isbn: '0123456789', quantity: 5 }]);
	expect(horsesStock).toEqual([{ isbn: '0123456789', quantity: 2 }]);
	expect(fullStock).toEqual([{ isbn: '0123456789', quantity: 7 }]);
};

// Tests using the extensive test data
export const addBooksToNote: TestFunction = async (db, getNotesAndWarehouses) => {
	const { notes, fullStock } = getNotesAndWarehouses(1);
	const [noteData] = notes;
	const { books } = noteData;

	const w = db.warehouse('test-warehouse');

	const note = await w.createInNote();

	const volumeQuantityTuples = books.map(({ isbn, quantity }) => [
		isbn,
		quantity
	]) as VolumeQuantityTuple[];

	await note.addVolumes(...volumeQuantityTuples);
	await note.commit();

	const wStock = await w.getStock();

	expect(wStock).toEqual(fullStock.books);
};

export const commitNote: TestFunction = async (db, getNotesAndWarehouses) => {
	// Stock after 1st note has been commited
	const { fullStock: stock1 } = getNotesAndWarehouses(1);

	// Stock after 2nd note has been commited
	const { notes, fullStock: stock2 } = getNotesAndWarehouses(2);

	const [vqTuple1, vqTuple2] = notes.map(({ books }) =>
		books.map(({ isbn, quantity }) => [isbn, quantity])
	) as VolumeQuantityTuple[][];

	const warehouse = db.warehouse('test-warehouse');
	const note1 = await warehouse.createInNote();
	await note1.addVolumes(...vqTuple1);

	const note2 = await warehouse.createInNote();
	await note2.addVolumes(...vqTuple2);

	let wStock = await warehouse.getStock();

	// No note is yet committed so results should be 0
	expect(wStock.length).toEqual(0);

	await note1.commit();
	// Only the quantity from the first note should be applied
	wStock = await warehouse.getStock();
	expect(wStock).toEqual(stock1.books);

	await note2.commit();
	wStock = await warehouse.getStock();
	expect(wStock).toEqual(stock2.books);
};

// This test is here to test commiting of multiple notes received from test data
// we test the commiting of larger number of notes in benchmark tests
export const test5Notes: TestFunction = async (db, getNotesAndWarehouses) => {
	const { fullStock, notes } = getNotesAndWarehouses(5);

	const w = db.warehouse();

	const noteUpdates = notes.map(
		(note) =>
			new Promise<void>((resolve, reject) => {
				(note.type === 'inbound' ? w.createInNote() : w.createOutNote())
					.then((n) =>
						n.addVolumes(
							...note.books.map(({ isbn, quantity }) => [isbn, quantity] as VolumeQuantityTuple)
						)
					)
					.then((n) => n.commit())
					.then(() => resolve())
					.catch((err) => reject(err));
			})
	);
	await Promise.all(noteUpdates);

	const stock = await w.getStock();

	expect(stock).toEqual(fullStock.books);
};
