/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'vitest';

import { TestFunction, VolumeTransactionTuple } from '@/types';

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

export const updateVolumeTransaction: TestFunction = async (db) => {
	const w = db.warehouse('wh');
	const note1 = await w.createInNote();
	await note1.addVolumes('0001112222', 5);

	let noteFromDB = await w.getNote(note1._id);
	let volumeTransactions = await noteFromDB.getVolume('0001112222');
	expect(volumeTransactions[0].quantity).toEqual(5);

	await note1.updateTransaction(0, { quantity: 2, warehouse: 'other-warehouse' });
	noteFromDB = await w.getNote(note1._id);
	volumeTransactions = await noteFromDB.getVolume('0001112222');
	expect(volumeTransactions[0].quantity).toEqual(2);
	expect(volumeTransactions[0].warehouse).toEqual('other-warehouse');
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

	expect(scienceStock).toEqual([{ isbn: '0123456789', quantity: 5, warehouse: 'science' }]);
	expect(horsesStock).toEqual([{ isbn: '0123456789', quantity: 2, warehouse: 'horses' }]);
	expect(fullStock).toEqual([
		{ isbn: '0123456789', quantity: 2, warehouse: 'horses' },
		{ isbn: '0123456789', quantity: 5, warehouse: 'science' }
	]);
};

// Tests using the extensive test data
export const addBooksToNote: TestFunction = async (db, getTestData) => {
	const { notes, fullStock } = getTestData(1);
	const [noteData] = notes;
	const { books } = noteData;

	const w = db.warehouse();

	const note = await w.createInNote();

	const volumeQuantityTuples = books.map(({ isbn, quantity, warehouse }) => [
		isbn,
		quantity,
		warehouse
	]) as VolumeTransactionTuple[];

	await note.addVolumes(...volumeQuantityTuples);
	await note.commit();

	const wStock = await w.getStock();

	expect(wStock).toEqual(fullStock.books);
};

export const commitNote: TestFunction = async (db, getTestData) => {
	// Stock after 1st note has been commited
	const { fullStock: stock1 } = getTestData(1);

	// Stock after 2nd note has been commited
	const { notes, fullStock: stock2 } = getTestData(2);

	const [vqTuple1, vqTuple2] = notes.map(({ books }) =>
		books.map(({ isbn, quantity, warehouse }) => [isbn, quantity, warehouse])
	) as VolumeTransactionTuple[][];

	const warehouse = db.warehouse();
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

	// Check that note documents have been updated with commit state
	const [n1DB, n2DB] = await Promise.all([note1._id, note2._id].map((id) => warehouse.getNote(id)));
	expect(n1DB.committed).toEqual(true);
	expect(n2DB.committed).toEqual(true);
};

// This test is here to test commiting of multiple notes received from test data
// we test the commiting of larger number of notes in benchmark tests
export const test5Notes: TestFunction = async (db, getTestData) => {
	const { fullStock, notes, warehouses } = getTestData(5);

	const w = db.warehouse();

	const noteUpdates = notes.map(
		(note) =>
			new Promise<void>((resolve, reject) =>
				(note.type === 'inbound' ? w.createInNote() : w.createOutNote())
					.then((n) =>
						n.addVolumes(
							...note.books.map(
								({ isbn, quantity, warehouse }) =>
									[isbn, quantity, warehouse] as VolumeTransactionTuple
							)
						)
					)
					.then((n) => n.commit())
					.then(() => resolve())
					.catch((err) => reject(err))
			)
	);
	await Promise.all(noteUpdates);

	const stock = await w.getStock();

	expect(stock).toEqual(fullStock.books);

	const warehouseAssertions = warehouses.map(async (warehouse) => {
		const w = db.warehouse(warehouse.id);

		const wStock = await w.getStock();
		expect(wStock).toEqual(warehouse.books);
	});
	await Promise.all(warehouseAssertions);
};
