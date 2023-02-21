/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'vitest';

import { InNoteList, NavListEntry, VolumeStock, NoteState } from '@librocco/db';

import { TestFunction } from '@/types';

import { versionId } from './utils/misc';

import { waitFor } from '@/__testUtils__';

// Base functionality
export const standardApi: TestFunction = async (db) => {
	// If warehouse doesn't exist, a new one should be initialised with default values
	// but no data should be saved to the db until explicitly done so.
	let wh1 = db.warehouse('wh1');
	expect(wh1._id).toEqual(versionId('wh1'));

	// Warehouse doesn't yet exist in the db.
	const whInDB = await wh1.get();
	expect(whInDB).toBeUndefined();

	// Save the warehouse to db and access from different instance.
	wh1 = await wh1.create();
	const wh1newInstance = await db.warehouse('wh1').get();
	expect(wh1newInstance).toEqual(wh1);

	// If note doesn't exist, a new one should be initialised with default values
	// but no data should be saved to the db until explicitly done so.
	let note1 = wh1.note('note-1');
	expect(note1._id).toBeTruthy();

	// Note doesn't yet exist in the db.
	const noteInDB = await note1.get();
	expect(noteInDB).toBeUndefined();

	// Save the note to db and access from different instance.
	note1 = await note1.create();
	const note1newInstance = await wh1.note('note-1').get();
	expect(note1newInstance).toEqual({ ...note1, displayName: 'New Note' });

	// Creating a new note (saving in the db) should also save the warehouse document to the db in one doesn't exist.
	const wh2 = db.warehouse('wh2');
	const note2 = wh2.note('note-2');
	// None of the two yet exists in the warheouse.
	const [wh2inDB, note2inDB] = await Promise.all([wh2.get(), note2.get()]);
	expect(wh2inDB).toBeUndefined();
	expect(note2inDB).toBeUndefined();
	// Saving the note should also save the warehouse.
	await note2.create();
	await waitFor(async () => {
		const [wh2inDB, note2inDB] = await Promise.all([wh2.get(), note2.get()]);
		expect(wh2inDB).toEqual(wh2);
		expect(note2inDB).toEqual(note2);
	});

	// DB interface should be able to find notes by their id.
	const note2found = await db.findNote(note2._id);
	expect(note2found).toEqual({ ...note2, displayName: 'New Note (2)' });
	// Non-existing notes should return undefined.
	// We're manipulating a dynamic id from note2 as id patterns might differ per implementation.
	// replacing last two letters should do the trick.
	const nonExistingId = note2._id.slice(0, -2) + 'zz';
	const nonExistingNote = await db.findNote(nonExistingId);
	expect(nonExistingNote).toBeUndefined();

	// Committed notes can't be updated nor deleted.
	note1 = await note1.setName('Note 1');
	expect(note1.displayName).toEqual('Note 1');
	await note1.commit();
	note1 = await note1.setName('New name');
	expect(note1.displayName).toEqual('Note 1');

	// Notes on the default warehouse should atomatically be outbound, and on specific warehouses inbound.
	const outboundNote = db.warehouse().note();
	const inboundNote = db.warehouse('wh1').note();
	expect(outboundNote.noteType).toEqual('outbound');
	expect(inboundNote.noteType).toEqual('inbound');
};

export const streamNoteValuesAccordingToSpec: TestFunction = async (db) => {
	// Create a new note
	const note = await db.warehouse('test-warehouse').note().create();

	// Subscribe to note streams
	const { displayName: dn$, entries: e$, state: s$, updatedAt: ua$ } = note.stream();

	let displayName: string | undefined = '';
	let entries: VolumeStock[] = [];
	let state: NoteState | undefined = undefined;
	let updatedAt: Date | undefined = undefined;

	dn$.subscribe((dn) => (displayName = dn));
	e$.subscribe((e) => (entries = e));
	s$.subscribe((s) => (state = s));
	ua$.subscribe((ua) => {
		updatedAt = ua;
	});

	// Check for displayName stream
	expect(displayName).toEqual('');
	await note.setName('test');
	await waitFor(() => {
		expect(displayName).toEqual('test');
	});

	// Check for entries stream
	expect(entries).toEqual([]);
	await note.addVolumes('0123456789', 2);
	await waitFor(() => {
		expect(entries).toEqual([
			{ isbn: '0123456789', quantity: 2, warehouseId: versionId('test-warehouse'), warehouseName: 'New Warehouse' }
		]);
	});

	// Check for state stream
	expect(state).toEqual(NoteState.Draft);
	await note.commit();
	await waitFor(() => {
		expect(state).toEqual(NoteState.Committed);
	});

	// Check for updatedAt stream
	const ts1 = note.updatedAt;
	// Perform any update
	const { updatedAt: ts2 } = await note.addVolumes('0123456789', 2);
	// Check that the latest timestamp is different than the old timestamp
	expect(ts1).toEqual(ts2);
	// Wait for the stream to update
	await waitFor(() => {
		expect(updatedAt?.toISOString()).toEqual(ts2);
	});
};

export const streamWarehouseStock: TestFunction = async (db) => {
	const warehouse1 = await db.warehouse('warehouse-1').create();
	const warehouse2 = await db.warehouse('warehouse-2').create();
	const defaultWarehouse = await db.warehouse().create();

	let warehoues1Stock: VolumeStock[] = [];
	let warehoues2Stock: VolumeStock[] = [];
	let defaultWarehouesStock: VolumeStock[] = [];

	// Subscribe to warehouse stock streams
	warehouse1.stream().entries.subscribe((e) => (warehoues1Stock = e));
	warehouse2.stream().entries.subscribe((e) => (warehoues2Stock = e));
	defaultWarehouse.stream().entries.subscribe((e) => (defaultWarehouesStock = e));

	// Adding books to warehouse 1 should display changes in warehouse 1 and default warehouse stock streams
	const note1 = warehouse1.note();
	await note1.addVolumes('0123456789', 3);
	await note1.commit();

	await waitFor(() => {
		expect(warehoues1Stock).toEqual([
			{ isbn: '0123456789', quantity: 3, warehouseId: versionId('warehouse-1'), warehouseName: 'New Warehouse' }
		]);
		expect(defaultWarehouesStock).toEqual([
			{ isbn: '0123456789', quantity: 3, warehouseId: versionId('warehouse-1'), warehouseName: 'New Warehouse' }
		]);
		expect(warehoues2Stock).toEqual([]);
	});

	// Adding books to warehouse 2 should display changes in warehouse 2 and aggregate the stock of both warehouses in the default warehouse stock stream
	const note2 = warehouse2.note();
	await note2.addVolumes('0123456789', 3);
	await note2.commit();

	await waitFor(() => {
		expect(warehoues1Stock).toEqual([
			{ isbn: '0123456789', quantity: 3, warehouseId: versionId('warehouse-1'), warehouseName: 'New Warehouse' }
		]);
		expect(defaultWarehouesStock).toEqual([
			{ isbn: '0123456789', quantity: 3, warehouseId: versionId('warehouse-1'), warehouseName: 'New Warehouse' },
			{ isbn: '0123456789', quantity: 3, warehouseId: versionId('warehouse-2'), warehouseName: 'New Warehouse (2)' }
		]);
		expect(warehoues2Stock).toEqual([
			{ isbn: '0123456789', quantity: 3, warehouseId: versionId('warehouse-2'), warehouseName: 'New Warehouse (2)' }
		]);
	});

	// Non committed notes should not be taken into account (when calculating the stock)
	const note3 = warehouse1.note();
	await note3.addVolumes('0123456789', 3);
	await waitFor(() => {
		expect(warehoues1Stock).toEqual([
			{ isbn: '0123456789', quantity: 3, warehouseId: versionId('warehouse-1'), warehouseName: 'New Warehouse' }
		]);
		// If the assertion for warehouse-1 (in this case) passes, the other two streams are implicitly not affected
		// (according to the previous two assertions)
	});

	// Outbound notes should decrement the stock (of both the particular warehouse, as well as the default warehouse)
	const note4 = defaultWarehouse.note();
	await note4.addVolumes('0123456789', 2, versionId('warehouse-1'));
	await note4.addVolumes('0123456789', 1, versionId('warehouse-2'));
	await note4.commit();
	await waitFor(() => {
		expect(warehoues1Stock).toEqual([
			{ isbn: '0123456789', quantity: 1, warehouseId: versionId('warehouse-1'), warehouseName: 'New Warehouse' }
		]);
		expect(defaultWarehouesStock).toEqual([
			{ isbn: '0123456789', quantity: 1, warehouseId: versionId('warehouse-1'), warehouseName: 'New Warehouse' },
			{ isbn: '0123456789', quantity: 2, warehouseId: versionId('warehouse-2'), warehouseName: 'New Warehouse (2)' }
		]);
		expect(warehoues2Stock).toEqual([
			{ isbn: '0123456789', quantity: 2, warehouseId: versionId('warehouse-2'), warehouseName: 'New Warehouse (2)' }
		]);
	});

	// Updating a warehouse name should be reflected in the stock stream
	await warehouse1.setName('Warehouse 1');
	await waitFor(() => {
		expect(warehoues1Stock).toEqual([
			{ isbn: '0123456789', quantity: 1, warehouseId: versionId('warehouse-1'), warehouseName: 'Warehouse 1' }
		]);
		expect(defaultWarehouesStock).toEqual([
			{ isbn: '0123456789', quantity: 1, warehouseId: versionId('warehouse-1'), warehouseName: 'Warehouse 1' },
			{ isbn: '0123456789', quantity: 2, warehouseId: versionId('warehouse-2'), warehouseName: 'New Warehouse (2)' }
		]);
	});

	// Zero quantity should remove the entry from the stock stream
	const note5 = defaultWarehouse.note();
	await note5.addVolumes('0123456789', 1, versionId('warehouse-1'));
	await note5.commit();
	await waitFor(() => {
		expect(warehoues1Stock).toEqual([]);
	});
};

export const warehousesListStream: TestFunction = async (db) => {
	const { warehouseList: wl$ } = db.stream();
	let warehouseList: NavListEntry[] = [];
	wl$.subscribe((wl) => (warehouseList = wl));

	// The default warehouse should be created automatically
	await waitFor(() => {
		expect(warehouseList).toEqual([{ id: versionId('0-all'), displayName: 'All' }]);
	});
	const warehouse = await db.warehouse('new-warehouse').create();
	await waitFor(() => {
		// The default ("0-all") warehouse should be created as well (when the first warehouse is created)
		expect(warehouseList).toEqual([
			{ id: versionId('0-all'), displayName: 'All' },
			{ id: versionId('new-warehouse'), displayName: 'New Warehouse' }
		]);
	});

	// Updating a warehouse name, should be reflected in warehouseList stream as well
	await warehouse.setName('New Name');
	await waitFor(() => {
		expect(warehouseList).toEqual([
			{ id: versionId('0-all'), displayName: 'All' },
			{ id: versionId('new-warehouse'), displayName: 'New Name' }
		]);
	});

	// Adding a note (for instance) shouldn't affect the warehouse list
	await warehouse.note().create();
	await waitFor(() => {
		expect(warehouseList).toEqual([
			{ id: versionId('0-all'), displayName: 'All' },
			{ id: versionId('new-warehouse'), displayName: 'New Name' }
		]);
	});
};

export const inNotesStream: TestFunction = async (db) => {
	const { inNoteList: inl$ } = db.stream();
	let inNoteList: InNoteList = [];

	// The stream should be initialized with the existing documents (it should display current state, not only the changes)
	const warehouse1 = await db.warehouse('warehouse-1').create();
	inl$.subscribe((inl) => (inNoteList = inl));

	await waitFor(() => {
		expect(inNoteList).toEqual([
			{ id: versionId('0-all'), displayName: 'All', notes: [] },
			{ id: versionId('warehouse-1'), displayName: 'New Warehouse', notes: [] }
		]);
	});

	// When a new inbound note is created, it should be added to the list (for both the particular warehouse, as well as the default warehouse)
	const note1 = await warehouse1.note().create();
	await waitFor(() => {
		expect(inNoteList).toEqual([
			{ id: versionId('0-all'), displayName: 'All', notes: [{ id: note1._id, displayName: 'New Note' }] },
			{ id: versionId('warehouse-1'), displayName: 'New Warehouse', notes: [{ id: note1._id, displayName: 'New Note' }] }
		]);
	});

	// Updating of the note name should be reflected in the stream
	await note1.setName('New Name');
	await waitFor(() => {
		expect(inNoteList).toEqual([
			{ id: versionId('0-all'), displayName: 'All', notes: [{ id: note1._id, displayName: 'New Name' }] },
			{ id: versionId('warehouse-1'), displayName: 'New Warehouse', notes: [{ id: note1._id, displayName: 'New Name' }] }
		]);
	});

	// Adding a note in another warehouse should add it to a particular warehouse, as well as the default warehouse
	const note2 = await db.warehouse('warehouse-2').note().create();
	await waitFor(() => {
		expect(inNoteList).toEqual([
			{
				id: versionId('0-all'),
				displayName: 'All',
				notes: [
					{ id: note1._id, displayName: 'New Name' },
					{ id: note2._id, displayName: 'New Note' }
				]
			},
			{ id: versionId('warehouse-1'), displayName: 'New Warehouse', notes: [{ id: note1._id, displayName: 'New Name' }] },
			{ id: versionId('warehouse-2'), displayName: 'New Warehouse (2)', notes: [{ id: note2._id, displayName: 'New Note' }] }
		]);
	});

	// Deleting a note should remove it from the list (but the warehouse should still be there)
	await note2.delete();
	await waitFor(() => {
		expect(inNoteList).toEqual([
			{ id: versionId('0-all'), displayName: 'All', notes: [{ id: note1._id, displayName: 'New Name' }] },
			{ id: versionId('warehouse-1'), displayName: 'New Warehouse', notes: [{ id: note1._id, displayName: 'New Name' }] },
			{ id: versionId('warehouse-2'), displayName: 'New Warehouse (2)', notes: [] }
		]);
	});

	// Outbound notes should not be included in the list
	await db.warehouse().note().create();
	// Testing the async update which shouldn't happen is a bit tricky, so we're applying additional update
	// which, most certainly should happen, but would happen after the not-wanted update, so we can assert that
	// only the latter took place.
	await note1.setName('New Note - Updated');
	await waitFor(() => {
		expect(inNoteList).toEqual([
			{ id: versionId('0-all'), displayName: 'All', notes: [{ id: note1._id, displayName: 'New Note - Updated' }] },
			{
				id: versionId('warehouse-1'),
				displayName: 'New Warehouse',
				notes: [{ id: note1._id, displayName: 'New Note - Updated' }]
			},
			{ id: versionId('warehouse-2'), displayName: 'New Warehouse (2)', notes: [] }
		]);
	});
};

export const outNotesStream: TestFunction = async (db) => {
	const { outNoteList: onl$ } = db.stream();
	let outNoteList: NavListEntry[] = [];

	// The stream should be initialized with the existing documents (it should display current state, not only the changes)
	const note1 = await db.warehouse().note().create();
	// Subscribe after the initial update to test the initial state being streamed
	onl$.subscribe((onl) => (outNoteList = onl));
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: 'New Note' }]);
	});

	// Add another note
	const note2 = await db.warehouse().note().create();
	await waitFor(() => {
		expect(outNoteList).toEqual([
			{ id: note1._id, displayName: 'New Note' },
			{ id: note2._id, displayName: 'New Note (2)' }
		]);
	});

	// Deleting the note should be reflected in the stream
	await note2.delete();
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: 'New Note' }]);
	});

	// Change of note display name should be reflected in the stream
	await note1.setName('New Name');
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: 'New Name' }]);
	});

	// Inbound notes should not be included in the list
	await db.warehouse('warehouse-1').note().create();
	// Testing the async update which shouldn't happen is a bit tricky, so we're applying additional update
	// which, most certainly should happen, but would happen after the not-wanted update, so we can assert that
	// only the latter took place.
	await note1.setName('New Note - Updated');
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: 'New Note - Updated' }]);
	});
};

export const sequenceWarehouseDesignDocument: TestFunction = async (db) => {
	const wh1 = await db.warehouse('0').create(); // New Warehouse
	const wh2 = await db.warehouse('1').create(); // New Warehouse (2)
	const wh3 = await db.warehouse('2').create(); // New Warehouse (3)

	expect(wh1.displayName).toEqual('New Warehouse');
	expect(wh2.displayName).toEqual('New Warehouse (2)');
	expect(wh3.displayName).toEqual('New Warehouse (3)');

	await wh1.setName('New Name1');
	await wh2.setName('New Name2');

	const wh4 = await db.warehouse('3').create(); // New Warehouse (4)
	expect(wh4.displayName).toEqual('New Warehouse (4)');

	await wh3.setName('New Name3');
	await wh4.setName('New Name4');

	const wh5 = await db.warehouse('4').create(); // New Warehouse
	expect(wh5.displayName).toEqual('New Warehouse');
};

export const sequenceNoteDesignDocument: TestFunction = async (db) => {
	const defaultWarehouse = await db.warehouse().create();

	const note1 = await defaultWarehouse.note().create(); // New Note

	const note2 = await defaultWarehouse.note().create(); // New Note (2)

	const note3 = await defaultWarehouse.note().create(); // New Note (2)

	expect(note1).toMatchObject({ displayName: 'New Note' });
	expect(note2).toMatchObject({ displayName: 'New Note (2)' });
	expect(note3).toMatchObject({ displayName: 'New Note (3)' });

	await note1.setName('New Name');
	await note2.setName('New Name2');
	const note4 = await defaultWarehouse.note().create(); // New Note
	expect(note4).toMatchObject({ displayName: 'New Note (4)' });

	await note3.setName('New Name');
	await note4.setName('New Name2');

	const note5 = await defaultWarehouse.note().create(); // New Note
	expect(note5).toMatchObject({ displayName: 'New Note' });
};
