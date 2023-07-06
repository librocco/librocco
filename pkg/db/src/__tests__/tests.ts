/* eslint-disable no-case-declarations */
import { expect } from "vitest";
import { BehaviorSubject, switchMap } from "rxjs";

import { testUtils } from "@librocco/shared";

import { NoteState } from "@/enums";

import { BookEntry, InNoteMap, NavMap, VersionedString, VolumeStock, VolumeStockClient } from "@/types";
import { TestFunction } from "@/test-runner/types";

import { versionId } from "@/utils/misc";

import { EmptyNoteError, OutOfStockError, TransactionWarehouseMismatchError } from "@/errors";
import { fiftyEntries } from "./data";

const { waitFor } = testUtils;

/**
 * We're using EMPTY as a symbol, rather than 'undefined' or 'null' to be able to differentiate,
 * with absolute certainty, between the stream not emitting anything and the stream emitting something.
 */
const EMPTY = Symbol("empty");
type PossiblyEmpty<T> = typeof EMPTY | T;

// Base functionality
export const standardApi: TestFunction = async (db) => {
	// If warehouse doesn't exist, a new one should be initialised with default values
	// but no data should be saved to the db until explicitly done so.
	let wh1 = db.warehouse("wh1");
	expect(wh1._id).toEqual(versionId("wh1"));

	// Warehouse doesn't yet exist in the db.
	const whInDB = await wh1.get();
	expect(whInDB).toBeUndefined();

	// Save the warehouse to db and access from different instance.
	wh1 = await wh1.create();
	const wh1newInstance = await db.warehouse("wh1").get();
	expect(wh1newInstance).toEqual(wh1);

	// If note doesn't exist, a new one should be initialised with default values
	// but no data should be saved to the db until explicitly done so.
	let note1 = wh1.note("note-1");
	expect(note1._id).toBeTruthy();

	// Note doesn't yet exist in the db.
	const noteInDB = await note1.get();
	expect(noteInDB).toBeUndefined();

	// Save the note to db and access from different instance.
	note1 = await note1.create();
	const note1newInstance = await wh1.note("note-1").get();
	expect(note1newInstance).toEqual({ ...note1, displayName: "New Note" });

	// Creating a new note (saving in the db) should also save the warehouse document to the db in one doesn't exist.
	const wh2 = db.warehouse("wh2");
	const note2 = wh2.note("note-2");
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
	const { note: note2found, warehouse: warehouse2Found } = (await db.findNote(note2._id)) || {};
	expect(note2found).toEqual({ ...note2, displayName: "New Note (2)" });
	expect(warehouse2Found).toEqual(wh2);

	// Non-existing notes should return undefined.
	// We're manipulating a dynamic id from note2 as id patterns might differ per implementation.
	// replacing last two letters should do the trick.
	const nonExistingId = note2._id.slice(0, -2) + "zz";
	const nonExistingNote = await db.findNote(nonExistingId);
	expect(nonExistingNote).toBeUndefined();

	// Committed notes can't be updated nor deleted.
	note1 = await note1.setName({}, "Note 1");
	expect(note1.displayName).toEqual("Note 1");
	await note1.commit({}, { force: true });
	note1 = await note1.setName({}, "New name");
	expect(note1.displayName).toEqual("Note 1");

	// Notes on the default warehouse should automatically be outbound, and on specific warehouses inbound.
	const outboundNote = db.warehouse().note();
	const inboundNote = db.warehouse("wh1").note();
	expect(outboundNote.noteType).toEqual("outbound");
	expect(inboundNote.noteType).toEqual("inbound");

	// Trying to access a note belonging to a different warehouse should throw an error.
	const wh1Note = db.warehouse("wh1").note("wh1-note");
	const wh1NoteFullId = wh1Note._id;
	let err;
	try {
		db.warehouse("wh2").note(wh1NoteFullId);
	} catch (e) {
		err = e;
	}
	expect(err).toBeDefined();
};

export const getEntriesQueries: TestFunction = async (db) => {
	// Set up warehouses
	const defaultWh = await db.warehouse().create();
	const wh1 = await db
		.warehouse("wh1")
		.create()
		.then((w) => w.setName({}, "Warehouse 1"));

	// Check for note
	const note = await wh1.note().create();
	await note.addVolumes({ isbn: "0123456789", quantity: 2 }, { isbn: "11111111", quantity: 4 });
	const entries = await note.getEntries({});
	expect([...entries]).toEqual([
		{ isbn: "0123456789", quantity: 2, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1" },
		{ isbn: "11111111", quantity: 4, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1" }
	]);

	// Check for warehouse
	// Note is not yet committed, so no entries should be returned.
	let wh1Entries = await wh1.getEntries({});
	expect([...wh1Entries]).toEqual([]);
	await note.commit({});
	wh1Entries = await wh1.getEntries({});
	expect([...wh1Entries]).toEqual([
		{ isbn: "0123456789", quantity: 2, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1" },
		{ isbn: "11111111", quantity: 4, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1" }
	]);

	// Should work all the same for the default warehouse
	const defaultWhEntries = await defaultWh.getEntries({});
	expect([...defaultWhEntries]).toEqual([
		{ isbn: "0123456789", quantity: 2, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1" },
		{ isbn: "11111111", quantity: 4, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1" }
	]);
};

export const noteTransactionOperations: TestFunction = async (db) => {
	// Set up two warehouses (with display names) and an outbound note
	const [wh1, wh2] = await Promise.all([db.warehouse("wh1").create(), db.warehouse("wh2").create()]);
	await Promise.all([wh1.setName({}, "Warehouse 1"), wh2.setName({}, "Warehouse 2")]);

	// @TODO: With current implementation, we're streaming all warehouses in the db as 'available warehouses' on each outbound note.
	// Update this when we implement a more fine grained approach.
	const availableWarehouses = [wh1, wh2].map(({ _id, displayName }) => ({ id: _id, displayName }));

	// We're testing against an outbound note as it lets us test against more robust functionality (different warehouses and such)
	const note = await db.warehouse().note().create();

	// Subscribe to entries to receive updates
	let entries: PossiblyEmpty<VolumeStockClientOld[]> = EMPTY;
	note.stream()
		.entries({})
		.subscribe(({ rows }) => (entries = rows.map((row) => volumeStockClientToVolumeStockClientOld(row))));

	// Initial stream should be empty
	await waitFor(() => {
		expect(entries).toEqual([]);
	});

	// Adding volumes should add transactions to the note
	await note.addVolumes(
		{ isbn: "0123456789", quantity: 2, warehouseId: wh1._id },
		// Having the same isbn for different warehouses will come in handy when testing update/remove transaction
		{ isbn: "11111111", quantity: 4, warehouseId: wh1._id },
		{ isbn: "11111111", quantity: 3 }
	);
	await waitFor(() => {
		expect(entries).toEqual([
			{ isbn: "0123456789", quantity: 2, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses },
			{ isbn: "11111111", quantity: 3, warehouseId: "", warehouseName: "not-found", availableWarehouses },
			{ isbn: "11111111", quantity: 4, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses }
		]);
	});

	// Adding volumes to the same ISBN/warheouseId pair should simply aggregate the quantities
	await note.addVolumes(
		// The add volumes operation should not confuse the transaction with the same isbn, but different warehouse
		{ isbn: "0123456789", quantity: 3, warehouseId: wh1._id },
		// This should also work if warehouse is not provided (falls back to "", in case of outbound note)
		{ isbn: "11111111", quantity: 7 }
	);
	await waitFor(() => {
		expect(entries).toEqual([
			{ isbn: "0123456789", quantity: 5, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses },
			{ isbn: "11111111", quantity: 10, warehouseId: "", warehouseName: "not-found", availableWarehouses },
			{ isbn: "11111111", quantity: 4, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses }
		]);
	});

	// Update transaction should overwrite the existing transaction (and not confuse it with the same isbn, but different warehouse)
	await note.updateTransaction({ isbn: "11111111", warehouseId: wh1._id }, { isbn: "11111111", quantity: 8, warehouseId: wh1._id });

	await waitFor(() => {
		expect(entries).toEqual([
			{ isbn: "0123456789", quantity: 5, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses },
			{ isbn: "11111111", quantity: 10, warehouseId: "", warehouseName: "not-found", availableWarehouses },
			{ isbn: "11111111", quantity: 8, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses }
		]);
	});

	// Update transaction should be able to update warehouseId for a transaction
	await note.updateTransaction({ isbn: "11111111" }, { isbn: "11111111", quantity: 10, warehouseId: "wh3" });
	await waitFor(() => {
		expect(entries).toEqual([
			{ isbn: "0123456789", quantity: 5, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses },
			{ isbn: "11111111", quantity: 8, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses },
			{ isbn: "11111111", quantity: 10, warehouseId: versionId("wh3"), warehouseName: "not-found", availableWarehouses }
		]);
	});

	// Remove transaction should remove the transaction (and not confuse it with the same isbn, but different warehouse)
	await note.removeTransactions({ isbn: "0123456789", warehouseId: wh1._id }, { isbn: "11111111", warehouseId: "wh3" });
	await waitFor(() => {
		expect(entries).toEqual([
			{ isbn: "11111111", quantity: 8, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses }
		]);
	});

	// Running remove transaction should be a no-op if the transaction doesn't exist
	await note.removeTransactions({ isbn: "12345678", warehouseId: versionId(wh1._id) });
	await waitFor(() => {
		expect(entries).toEqual([
			{ isbn: "11111111", quantity: 8, warehouseId: versionId(wh1._id), warehouseName: "Warehouse 1", availableWarehouses }
		]);
	});
};

export const streamNoteValuesAccordingToSpec: TestFunction = async (db) => {
	// Create a new note
	const note = await db.warehouse("test-warehouse").note().create();

	// Subscribe to note streams
	const { displayName: displayNameStream, state: stateStream, updatedAt: updatedAtStream } = note.stream();

	let displayName: PossiblyEmpty<string> = EMPTY;
	// Note: entries holds only the 10 entries displayed per page
	let entries: {
		rows: PossiblyEmpty<VolumeStockClient[]>;
		total: PossiblyEmpty<number>;
		totalPages: PossiblyEmpty<number>;
	} = {
		rows: EMPTY,
		total: EMPTY,
		totalPages: EMPTY
	};
	let state: PossiblyEmpty<NoteState> = EMPTY;
	let updatedAt: PossiblyEmpty<Date | null> = EMPTY;

	displayNameStream({}).subscribe((dn) => (displayName = dn));
	stateStream({}).subscribe((s) => (state = s));
	updatedAtStream({}).subscribe((ua) => {
		updatedAt = ua;
	});

	// Streams used to test pagination
	const currentPage = new BehaviorSubject(0);
	const paginate = (page: number) => currentPage.next(page);
	const entriesWithPagination = currentPage.pipe(switchMap((page) => note.stream().entries({}, page)));

	entriesWithPagination.subscribe((e) => (entries = e));

	// Check that the stream gets initialised with the current values
	await waitFor(() => {
		expect(displayName).toEqual("New Note");
		expect(state).toEqual(NoteState.Draft);
		expect(updatedAt).toBeDefined();
		expect(entries.rows).toEqual([]);
	});

	// Check for display name
	await note.setName({}, "test");
	await waitFor(() => {
		expect(displayName).toEqual("test");
	});

	// Check for entries stream
	expect(entries.rows).toEqual([]);
	await note.addVolumes({ isbn: "0123456789", quantity: 2 });
	await waitFor(() => {
		expect(entries.rows).toEqual([
			{
				isbn: "0123456789",
				quantity: 2,
				warehouseId: versionId("test-warehouse"),
				warehouseName: "New Warehouse"
			}
		]);
	});

	// Check for entries pagination
	//
	// Reset the entries
	await note.removeTransactions({ isbn: "0123456789", warehouseId: "test-warehouse" });
	await waitFor(() => expect(entries.rows).toEqual([]));
	// Add 20 entries and check pagination results
	await note.addVolumes(...fiftyEntries.slice(0, 20));
	await waitFor(() => {
		expect(entries.rows).toEqual(
			fiftyEntries.slice(0, 10).map((e) => ({ ...e, warehouseId: versionId("test-warehouse"), warehouseName: "New Warehouse" }))
		);
		expect(entries.total).toEqual(20);
		expect(entries.totalPages).toEqual(2);
	});
	// Paginate to the next page
	paginate(1);
	await waitFor(() => {
		expect(entries.rows).toEqual(
			fiftyEntries.slice(10, 20).map((e) => ({ ...e, warehouseId: versionId("test-warehouse"), warehouseName: "New Warehouse" }))
		);
		expect(entries.total).toEqual(20);
		expect(entries.totalPages).toEqual(2);
	});
	// Updating a particular transaction (if belonging to the current page) should be streamed to the client.
	const matchTxn = fiftyEntries[10];
	const updateTxn = { ...matchTxn, quantity: 100, warehouseId: versionId("test-warehouse") };
	await note.updateTransaction(matchTxn, updateTxn);
	await waitFor(() =>
		expect(entries.rows).toEqual([
			{ ...updateTxn, warehouseName: "New Warehouse" },
			...fiftyEntries.slice(11, 20).map((e) => ({ ...e, warehouseId: versionId("test-warehouse"), warehouseName: "New Warehouse" }))
		])
	);

	// Check for state stream
	expect(state).toEqual(NoteState.Draft);
	await note.commit({});
	await waitFor(() => {
		expect(state).toEqual(NoteState.Committed);
	});
	// Check for updatedAt stream
	const ts1 = note.updatedAt;
	// Perform any update
	const { updatedAt: ts2 } = await note.addVolumes({ isbn: "0123456789", quantity: 2 });
	// Check that the latest timestamp is the same as the previous one (no update should have taken place)
	expect(ts1).toEqual(ts2);
	// Wait for the stream to update
	await waitFor(() => {
		expect((updatedAt as Date).toISOString()).toEqual(ts2);
	});

	// Deleting a note should stream deleted state
	//
	// We're using a different note as the previous one has already been committed.
	let note2State: PossiblyEmpty<NoteState> = EMPTY;
	const note2 = await db.warehouse("test-warehouse").note().create();
	note2
		.stream()
		.state({})
		.subscribe((s) => (note2State = s));

	await note2.delete({});
	await waitFor(() => {
		expect(note2State).toEqual(NoteState.Deleted);
	});
};

export const streamWarehouseStock: TestFunction = async (db) => {
	const warehouse1 = await db.warehouse("warehouse-1").create();
	const warehouse2 = await db.warehouse("warehouse-2").create();
	const defaultWarehouse = await db.warehouse().create();

	let warehouse1Stock: PossiblyEmpty<VolumeStock[]> = EMPTY;
	let warehouse2Stock: PossiblyEmpty<VolumeStock[]> = EMPTY;
	let defaultWarehouseStock: PossiblyEmpty<VolumeStock[]> = EMPTY;

	// Subscribe to warehouse stock streams
	warehouse1
		.stream()
		.entries({})
		.subscribe(({ rows }) => (warehouse1Stock = rows));
	warehouse2
		.stream()
		.entries({})
		.subscribe(({ rows }) => (warehouse2Stock = rows));
	defaultWarehouse
		.stream()
		.entries({})
		.subscribe(({ rows }) => (defaultWarehouseStock = rows));

	// Check that the stream gets initialised with the current values
	await waitFor(() => {
		expect(warehouse1Stock).toEqual([]);
		expect(warehouse2Stock).toEqual([]);
		expect(defaultWarehouseStock).toEqual([]);
	});

	// Adding books to warehouse 1 should display changes in warehouse 1 and default warehouse stock streams
	const note1 = warehouse1.note();
	await note1.addVolumes({ isbn: "0123456789", quantity: 3 });
	await note1.commit({});

	await waitFor(() => {
		expect(warehouse1Stock).toEqual([
			{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse" }
		]);
		expect(defaultWarehouseStock).toEqual([
			{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse" }
		]);
		expect(warehouse2Stock).toEqual([]);
	});

	// Adding books to warehouse 2 should display changes in warehouse 2 and aggregate the stock of both warehouses in the default warehouse stock stream
	const note2 = warehouse2.note();
	await note2.addVolumes({ isbn: "0123456789", quantity: 3 });
	await note2.commit({});

	await waitFor(() => {
		expect(warehouse1Stock).toEqual([
			{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse" }
		]);
		expect(defaultWarehouseStock).toEqual([
			{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse" },
			{
				isbn: "0123456789",
				quantity: 3,
				warehouseId: versionId("warehouse-2"),
				warehouseName: "New Warehouse (2)"
			}
		]);
		expect(warehouse2Stock).toEqual([
			{
				isbn: "0123456789",
				quantity: 3,
				warehouseId: versionId("warehouse-2"),
				warehouseName: "New Warehouse (2)"
			}
		]);
	});

	// Non committed notes should not be taken into account (when calculating the stock)
	const note3 = warehouse1.note();
	await note3.addVolumes({ isbn: "0123456789", quantity: 3 });
	await waitFor(() => {
		expect(warehouse1Stock).toEqual([
			{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse" }
		]);
		// If the assertion for warehouse-1 (in this case) passes, the other two streams are implicitly not affected
		// (according to the previous two assertions)
	});

	// Outbound notes should decrement the stock (of both the particular warehouse, as well as the default warehouse)
	const note4 = defaultWarehouse.note();
	await note4.addVolumes(
		{ isbn: "0123456789", quantity: 2, warehouseId: "warehouse-1" },
		{ isbn: "0123456789", quantity: 1, warehouseId: "warehouse-2" }
	);

	await note4.commit({});
	await waitFor(() => {
		expect(warehouse1Stock).toEqual([
			{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse" }
		]);
		expect(defaultWarehouseStock).toEqual([
			{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse" },
			{
				isbn: "0123456789",
				quantity: 2,
				warehouseId: versionId("warehouse-2"),
				warehouseName: "New Warehouse (2)"
			}
		]);
		expect(warehouse2Stock).toEqual([
			{
				isbn: "0123456789",
				quantity: 2,
				warehouseId: versionId("warehouse-2"),
				warehouseName: "New Warehouse (2)"
			}
		]);
	});

	// Updating a warehouse name should be reflected in the stock stream
	await warehouse1.setName({}, "Warehouse 1");
	await waitFor(() => {
		expect(warehouse1Stock).toEqual([
			{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1" }
		]);
		expect(defaultWarehouseStock).toEqual([
			{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1" },
			{
				isbn: "0123456789",
				quantity: 2,
				warehouseId: versionId("warehouse-2"),
				warehouseName: "New Warehouse (2)"
			}
		]);
	});

	// Zero quantity should remove the entry from the stock stream
	const note5 = defaultWarehouse.note();
	await note5.addVolumes({ isbn: "0123456789", quantity: 1, warehouseId: "warehouse-1" });
	await note5.commit({});
	await waitFor(() => {
		expect(warehouse1Stock).toEqual([]);
		expect(defaultWarehouseStock).toEqual([
			{
				isbn: "0123456789",
				quantity: 2,
				warehouseId: versionId("warehouse-2"),
				warehouseName: "New Warehouse (2)"
			}
		]);
	});

	// Note transactions with zero quantity should not affect the stock
	const note6 = warehouse1.note();
	await note6.addVolumes(
		{ isbn: "0123456789", quantity: 0, warehouseId: "warehouse-1" },
		// Other transaction is here to:
		// - check that it is taken into account (only 0-quantity transactions are ignored, not the entire note)
		// - to confirm an update has happened (as testing for something not being applied will pass immeditealy, due to async nature)
		{ isbn: "11111111", quantity: 1, warehouseId: "warehouse-1" }
	);
	await note6.commit({});
	await waitFor(() => {
		expect(warehouse1Stock).toEqual([
			{ isbn: "11111111", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1" }
		]);
		expect(defaultWarehouseStock).toEqual([
			{
				isbn: "0123456789",
				quantity: 2,
				warehouseId: versionId("warehouse-2"),
				warehouseName: "New Warehouse (2)"
			},
			{ isbn: "11111111", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1" }
		]);
	});
};

export const warehousePaginationStream: TestFunction = async (db) => {
	const warehouse = await db.warehouse("wh1").create();

	// Subscribe to paginated warehouse stream
	let entries: {
		rows: PossiblyEmpty<VolumeStockClient[]>;
		total: PossiblyEmpty<number>;
		totalPages: PossiblyEmpty<number>;
	} = {
		rows: EMPTY,
		total: EMPTY,
		totalPages: EMPTY
	};

	// Streams used to test pagination
	const currentPage = new BehaviorSubject(0);
	const paginate = (page: number) => currentPage.next(page);
	const entriesWithPagination = currentPage.pipe(switchMap((page) => warehouse.stream().entries({}, page)));
	entriesWithPagination.subscribe((e) => (entries = e));

	await waitFor(() => {
		expect(entries.rows).toEqual([]);
		expect(entries.total).toEqual(0);
		expect(entries.totalPages).toEqual(0);
	});

	// Add some volumes to the warehouse
	await warehouse
		.note()
		.addVolumes(...fiftyEntries.slice(0, 20))
		.then((n) => n.commit({}));
	await waitFor(() => {
		expect(entries.rows).toEqual(
			fiftyEntries.slice(0, 10).map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse" }))
		);
		expect(entries.total).toEqual(20);
		expect(entries.totalPages).toEqual(2);
	});

	// Paginate to the second page
	paginate(1);
	await waitFor(() => {
		expect(entries.rows).toEqual(
			fiftyEntries.slice(10, 20).map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse" }))
		);
		expect(entries.total).toEqual(20);
		expect(entries.totalPages).toEqual(2);
	});

	// Add additional volumes
	await warehouse
		.note()
		.addVolumes(...fiftyEntries.slice(20, 28))
		.then((n) => n.commit({}));
	await waitFor(() => {
		// We're still on the second page, only the total number of items/pages should have changed
		expect(entries.rows).toEqual(
			fiftyEntries.slice(10, 20).map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse" }))
		);
		expect(entries.total).toEqual(28);
		expect(entries.totalPages).toEqual(3);
	});

	// Removing items from the current page should update the stream,
	// still showing 10 items, filling the gap with items from the next page.
	await db
		.warehouse()
		.note()
		// Adding some of the transactions to and outbound note (same quantity) should simply remove said books from stock
		.addVolumes(...fiftyEntries.slice(10, 19).map((v) => ({ ...v, warehouseId: "wh1" })))
		.then((n) => n.commit({}));
	await waitFor(() => {
		expect(entries.rows).toEqual(
			fiftyEntries.slice(19, 28).map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse" }))
		);
		expect(entries.total).toEqual(19);
		expect(entries.totalPages).toEqual(2);
	});
};

export const warehousesListStream: TestFunction = async (db) => {
	const wl$ = db.stream().warehouseList({});
	let warehouseList: PossiblyEmpty<NavListEntry[]> = EMPTY;
	wl$.subscribe((wl) => (warehouseList = navMapToNavList(wl)));

	// The default warehouse should be created automatically
	await waitFor(() => {
		expect(warehouseList).toEqual([{ id: versionId("0-all"), displayName: "All" }]);
	});
	const warehouse = await db.warehouse("new-warehouse").create();
	await waitFor(() => {
		// The default ("0-all") warehouse should be created as well (when the first warehouse is created)
		expect(warehouseList).toEqual([
			{ id: versionId("0-all"), displayName: "All" },
			{ id: versionId("new-warehouse"), displayName: "New Warehouse" }
		]);
	});

	// Updating a warehouse name, should be reflected in warehouseList stream as well
	await warehouse.setName({}, "New Name");
	await waitFor(() => {
		expect(warehouseList).toEqual([
			{ id: versionId("0-all"), displayName: "All" },
			{ id: versionId("new-warehouse"), displayName: "New Name" }
		]);
	});

	// Adding a note (for instance) shouldn't affect the warehouse list
	await warehouse.note().create();
	await waitFor(() => {
		expect(warehouseList).toEqual([
			{ id: versionId("0-all"), displayName: "All" },
			{ id: versionId("new-warehouse"), displayName: "New Name" }
		]);
	});
};

export const inNotesStream: TestFunction = async (db) => {
	const inl$ = db.stream().inNoteList({});
	let inNoteList: PossiblyEmpty<InNoteList> = EMPTY;
	let actual: PossiblyEmpty<InNoteMap> = EMPTY;

	// The stream should be initialized with the existing documents (it should display current state, not only the changes)
	const warehouse1 = await db.warehouse("warehouse-1").create();
	inl$.subscribe((inl) => {
		inNoteList = inNoteMapToInNoteList(inl);
		actual = inl;
	});

	try {
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{ id: versionId("0-all"), displayName: "All", notes: [] },
				{ id: versionId("warehouse-1"), displayName: "New Warehouse", notes: [] }
			]);
		});

		// When a new inbound note is created, it should be added to the list (for both the particular warehouse, as well as the default warehouse)
		const note1 = await warehouse1.note().create();
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{ id: versionId("0-all"), displayName: "All", notes: [{ id: note1._id, displayName: "New Note" }] },
				{
					id: versionId("warehouse-1"),
					displayName: "New Warehouse",
					notes: [{ id: note1._id, displayName: "New Note" }]
				}
			]);
		});

		// Updating of the note name should be reflected in the stream
		await note1.setName({}, "New Name");
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{ id: versionId("0-all"), displayName: "All", notes: [{ id: note1._id, displayName: "New Name" }] },
				{
					id: versionId("warehouse-1"),
					displayName: "New Warehouse",
					notes: [{ id: note1._id, displayName: "New Name" }]
				}
			]);
		});

		// Adding a note in another warehouse should add it to a particular warehouse, as well as the default warehouse
		const note2 = await db.warehouse("warehouse-2").note().create();
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{
					id: versionId("0-all"),
					displayName: "All",
					notes: [
						{ id: note1._id, displayName: "New Name" },
						{ id: note2._id, displayName: "New Note" }
					]
				},
				{
					id: versionId("warehouse-1"),
					displayName: "New Warehouse",
					notes: [{ id: note1._id, displayName: "New Name" }]
				},
				{
					id: versionId("warehouse-2"),
					displayName: "New Warehouse (2)",
					notes: [{ id: note2._id, displayName: "New Note" }]
				}
			]);
		});

		// Deleting a note should remove it from the list (but the warehouse should still be there)
		await note2.delete({});
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{ id: versionId("0-all"), displayName: "All", notes: [{ id: note1._id, displayName: "New Name" }] },
				{
					id: versionId("warehouse-1"),
					displayName: "New Warehouse",
					notes: [{ id: note1._id, displayName: "New Name" }]
				},
				{ id: versionId("warehouse-2"), displayName: "New Warehouse (2)", notes: [] }
			]);
		});

		// Outbound notes should not be included in the list
		await db.warehouse().note().create();
		// Testing the async update which shouldn't happen is a bit tricky, so we're applying additional update
		// which, most certainly should happen, but would happen after the not-wanted update, so we can assert that
		// only the latter took place.
		await note1.setName({}, "New Note - Updated");
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{
					id: versionId("0-all"),
					displayName: "All",
					notes: [{ id: note1._id, displayName: "New Note - Updated" }]
				},
				{
					id: versionId("warehouse-1"),
					displayName: "New Warehouse",
					notes: [{ id: note1._id, displayName: "New Note - Updated" }]
				},
				{ id: versionId("warehouse-2"), displayName: "New Warehouse (2)", notes: [] }
			]);
		});

		// Should not stream committed notes
		const note3 = await warehouse1.note().create();
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{
					id: versionId("0-all"),
					displayName: "All",
					notes: [
						{ id: note1._id, displayName: "New Note - Updated" },
						{
							id: note3._id,
							// There's already an outbound note with the name "New Note"
							displayName: "New Note (2)"
						}
					]
				},
				{
					id: versionId("warehouse-1"),
					displayName: "New Warehouse",
					notes: [
						{ id: note1._id, displayName: "New Note - Updated" },
						{ id: note3._id, displayName: "New Note (2)" }
					]
				},
				{ id: versionId("warehouse-2"), displayName: "New Warehouse (2)", notes: [] }
			]);
		});

		await note3.commit({}, { force: true });
		await waitFor(() => {
			expect(inNoteList).toEqual([
				{
					id: versionId("0-all"),
					displayName: "All",
					notes: [{ id: note1._id, displayName: "New Note - Updated" }]
				},
				{
					id: versionId("warehouse-1"),
					displayName: "New Warehouse",
					notes: [{ id: note1._id, displayName: "New Note - Updated" }]
				},
				{ id: versionId("warehouse-2"), displayName: "New Warehouse (2)", notes: [] }
			]);
		});
	} catch (err) {
		console.log(actual);
		throw err;
	}
};

export const outNotesStream: TestFunction = async (db) => {
	const onl$ = db.stream().outNoteList({});
	let outNoteList: PossiblyEmpty<NavListEntry[]> = EMPTY;

	// The stream should be initialized with the existing documents (it should display current state, not only the changes)
	const note1 = await db.warehouse().note().create();
	// Subscribe after the initial update to test the initial state being streamed
	onl$.subscribe((onl) => (outNoteList = navMapToNavList(onl)));
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: "New Note" }]);
	});

	// Add another note
	const note2 = await db.warehouse().note().create();
	await waitFor(() => {
		expect(outNoteList).toEqual([
			{ id: note1._id, displayName: "New Note" },
			{ id: note2._id, displayName: "New Note (2)" }
		]);
	});

	// Deleting the note should be reflected in the stream
	await note2.delete({});
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: "New Note" }]);
	});

	// Change of note display name should be reflected in the stream
	await note1.setName({}, "New Name");
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: "New Name" }]);
	});

	// Inbound notes should not be included in the list
	await db.warehouse("warehouse-1").note().create();
	// Testing the async update which shouldn't happen is a bit tricky, so we're applying additional update
	// which, most certainly should happen, but would happen after the not-wanted update, so we can assert that
	// only the latter took place.
	await note1.setName({}, "New Note - Updated");
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: "New Note - Updated" }]);
	});

	// Should not stream committed notes
	const note3 = await db.warehouse().note().create();
	await waitFor(() => {
		expect(outNoteList).toEqual([
			{ id: note1._id, displayName: "New Note - Updated" },
			// There's already an inbound note with the name "New Note"
			{ id: note3._id, displayName: "New Note (2)" }
		]);
	});

	await note3.commit({}, { force: true });
	await waitFor(() => {
		expect(outNoteList).toEqual([{ id: note1._id, displayName: "New Note - Updated" }]);
	});
};

export const sequenceWarehouseDesignDocument: TestFunction = async (db) => {
	const wh1 = await db.warehouse("0").create(); // New Warehouse
	const wh2 = await db.warehouse("1").create(); // New Warehouse (2)
	const wh3 = await db.warehouse("2").create(); // New Warehouse (3)

	expect(wh1.displayName).toEqual("New Warehouse");
	expect(wh2.displayName).toEqual("New Warehouse (2)");
	expect(wh3.displayName).toEqual("New Warehouse (3)");

	await wh1.setName({}, "New Name1");
	await wh2.setName({}, "New Name2");

	const wh4 = await db.warehouse("3").create(); // New Warehouse (4)
	expect(wh4.displayName).toEqual("New Warehouse (4)");

	await wh3.setName({}, "New Name3");
	await wh4.setName({}, "New Name4");

	const wh5 = await db.warehouse("4").create(); // New Warehouse
	expect(wh5.displayName).toEqual("New Warehouse");
};

export const sequenceNoteDesignDocument: TestFunction = async (db) => {
	const defaultWarehouse = await db.warehouse().create();

	const note1 = await defaultWarehouse.note().create(); // New Note

	const note2 = await defaultWarehouse.note().create(); // New Note (2)

	const note3 = await defaultWarehouse.note().create(); // New Note (2)

	expect(note1).toMatchObject({ displayName: "New Note" });
	expect(note2).toMatchObject({ displayName: "New Note (2)" });
	expect(note3).toMatchObject({ displayName: "New Note (3)" });

	await note1.setName({}, "New Name");
	await note2.setName({}, "New Name2");
	const note4 = await defaultWarehouse.note().create(); // New Note
	expect(note4).toMatchObject({ displayName: "New Note (4)" });

	await note3.setName({}, "New Name");
	await note4.setName({}, "New Name2");

	const note5 = await defaultWarehouse.note().create(); // New Note
	expect(note5).toMatchObject({ displayName: "New Note" });
};

export const streamsShouldFallBackToDefaultValueForTheirType: TestFunction = async (db) => {
	// Db streams
	let inNoteList: PossiblyEmpty<InNoteList> = EMPTY;
	let outNoteList: PossiblyEmpty<NavListEntry[]> = EMPTY;
	let warehouseList: PossiblyEmpty<NavListEntry[]> = EMPTY;
	db.stream()
		.inNoteList({})
		.subscribe((inl) => (inNoteList = inNoteMapToInNoteList(inl)));
	db.stream()
		.outNoteList({})
		.subscribe((onl) => (outNoteList = navMapToNavList(onl)));
	db.stream()
		.warehouseList({})
		.subscribe((wl) => (warehouseList = navMapToNavList(wl)));
	// The default warehosue gets created automatically, so we will essentially
	// always be receiving the default warehouse in the warehouse (and in-note) list
	const defaultWarehouse = {
		id: versionId("0-all"),
		displayName: "All"
	};
	await waitFor(() => {
		expect(inNoteList).toEqual([{ ...defaultWarehouse, notes: [] }]);
		expect(outNoteList).toEqual([]);
		expect(warehouseList).toEqual([defaultWarehouse]);
	});

	// Warehouse streams
	const warehouse1 = db.warehouse("warehouse-1");
	let w1entries: PossiblyEmpty<VolumeStockClient[]> = EMPTY;
	let w1DisplayName: PossiblyEmpty<string> = EMPTY;
	// Subscribing to the stream should not throw (even if the warehouse doesn't exist)
	warehouse1
		.stream()
		.entries({})
		.subscribe(({ rows }) => (w1entries = rows));
	warehouse1
		.stream()
		.displayName({})
		.subscribe((w1dn) => (w1DisplayName = w1dn));
	await waitFor(() => {
		expect(w1entries).toEqual([]);
		expect(w1DisplayName).toEqual("");
	});

	// Note streams
	// Subscribing to the stream should not throw (even if the note doesn't exist)
	const note1 = db.warehouse().note();
	let n1entries: VolumeStockClient[] | undefined = undefined;
	let n1DisplayName: PossiblyEmpty<string> = EMPTY;
	let n1State: PossiblyEmpty<NoteState> = EMPTY;
	let n1UpdatedAt: PossiblyEmpty<Date | null> = EMPTY;
	// Subscribing to the stream should not throw (even if the note doesn't exist)
	// and the stream should be initialized with an empty array
	note1
		.stream()
		.entries({})
		.subscribe(({ rows }) => (n1entries = rows));
	note1
		.stream()
		.displayName({})
		.subscribe((n1dn) => (n1DisplayName = n1dn));
	note1
		.stream()
		.state({})
		.subscribe((n1s) => (n1State = n1s));
	note1
		.stream()
		.updatedAt({})
		.subscribe((n1u) => (n1UpdatedAt = n1u));
	await waitFor(() => {
		expect(n1entries).toEqual([]);
		expect(n1DisplayName).toEqual("");
		expect(n1State).toEqual(NoteState.Draft);
		expect(n1UpdatedAt).toEqual(null);
	});
};

export const booksInterface: TestFunction = async (db) => {
	const book1 = {
		isbn: "0195399706",
		title: "The Age of Wonder",
		authors: "Richard Holmes",
		publisher: "HarperCollins UK",
		year: "2008",
		price: 69.99
	};
	const book2 = {
		isbn: "019976915X",
		title: "Twelve Bar Blues",
		authors: "Patrick Neate",
		publisher: "Penguin UK",
		year: "2002",
		price: 39.86
	};
	const book3 = {
		isbn: "0194349276",
		title: "Holiday Jazz Chants",
		authors: "Carolyn Graham",
		publisher: "Oxford",
		year: "1999",
		price: 39.86
	};

	const booksInterface = db.books();

	// insert test

	await Promise.all([booksInterface.upsert([{ ...book1 }, { ...book2 }])]);

	const booksFromDb = await booksInterface.get([book1.isbn, book2.isbn]);

	expect(booksFromDb).toEqual([book1, book2]);

	// update test

	await Promise.all([
		booksInterface.upsert([
			{ ...book1, title: "Updated Title" },
			{ ...book2, title: "Updated Title 12" }
		])
	]);

	const [updatedBooksFromDb] = await Promise.all([booksInterface.get([book1.isbn, book2.isbn])]);

	expect(updatedBooksFromDb).toEqual([
		{ ...book1, title: "Updated Title" },
		{ ...book2, title: "Updated Title 12" }
	]);

	// stream test

	let bookEntries: (BookEntry | undefined)[] = [];

	booksInterface.stream({}, [book1.isbn, book2.isbn, book3.isbn]).subscribe((stream) => {
		bookEntries = stream;
	});

	await waitFor(() => {
		expect(bookEntries).toEqual([{ ...book1, title: "Updated Title" }, { ...book2, title: "Updated Title 12" }, undefined]);
	});

	// Stream should update when the book in the db is updated
	await db.books().upsert([{ ...book1, title: "Stream updated title" }]);

	await waitFor(() => {
		expect(bookEntries).toEqual([{ ...book1, title: "Stream updated title" }, { ...book2, title: "Updated Title 12" }, undefined]);
	});

	// Stream should update if the book we're requesting (which didn't exist) is added
	await db.books().upsert([book3]);

	await waitFor(() => {
		expect(bookEntries).toEqual([{ ...book1, title: "Stream updated title" }, { ...book2, title: "Updated Title 12" }, book3]);
	});
};

export const dbGuards: TestFunction = async (db) => {
	// The db should not allow for committing of inbound notes with transactions belonging
	// to warehouse different then note's parent warehouse.
	const note1 = await db.warehouse("warehouse-1").note().create();
	await note1.addVolumes({ isbn: "12345678", quantity: 2, warehouseId: "warehouse-2" });

	await expect(note1.commit({})).rejects.toThrow(
		new TransactionWarehouseMismatchError(versionId("warehouse-1"), [{ isbn: "12345678", warehouseId: versionId("warehouse-2") }])
	);

	// The db should not alow for committing of outbound notes with transactions specifying a quantity
	// greater than the quantity available, for a given isbn in the given warehouse.
	const wh1 = db.warehouse("warehouse-1");

	// Add some books to the warehouse
	await wh1
		.note()
		.create()
		.then((n) =>
			n.addVolumes(
				{ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" },
				{ isbn: "12345678", quantity: 3, warehouseId: "warehouse-1" }
			)
		)
		.then((n) => n.commit({}));

	// Current state of the warehouse is:
	// "11111111": 2
	// "12345678": 3

	// Try and commit an outbound note with a quantity greater than the available quantity
	const note2 = await db
		.warehouse()
		.note()
		.create()
		// "11111111": 4 (required) > "11111111": 2 (available in warehouse)
		.then((n) => n.addVolumes({ isbn: "11111111", quantity: 4, warehouseId: "warehouse-1" }));

	await expect(note2.commit({})).rejects.toThrow(
		new OutOfStockError([{ isbn: "11111111", warehouseId: versionId("warehouse-1"), quantity: 4, available: 2 }])
	);

	// Add 2 more "11111111" books to the warehouse: This way we should have 4 available, which is enough to commit the note2
	// Note: It's important that the this note doesn't contain more that 4 books as that test case would pass even if the
	// db didn't account for all the books in the warehouse (only the latest note): This was an actual bug, producing this test case.
	await wh1
		.note()
		.create()
		.then((n) => n.addVolumes({ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" }))
		.then((n) => n.commit({}));

	// Current state of the warehouse is:
	// "11111111": 4
	// "12345678": 3

	// It should commit without errors now
	await note2.commit({});

	// Current state of the warehouse is:
	// "11111111": 0
	// "12345678": 3

	// Test that outbond notes are also taken into account when checking for available quantities
	expect(
		db
			.warehouse()
			.note()
			.create()
			// There are no more "11111111" books available in the warehouse
			.then((n) => n.addVolumes({ isbn: "11111111", quantity: 1, warehouseId: "warehouse-1" }))
			.then((n) => n.commit({}))
	).rejects.toThrow(new OutOfStockError([{ isbn: "11111111", warehouseId: versionId("warehouse-1"), quantity: 1, available: 0 }]));

	// The validation error should be the same if warehouse not provided
	await expect(
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.addVolumes({ isbn: "11111111", quantity: 2 }))
			.then((n) => n.commit({}))
	).rejects.toThrow(new OutOfStockError([{ isbn: "11111111", warehouseId: "" as VersionedString, quantity: 2, available: 0 }]));

	// The db should not allow the committing of empty notes
	await expect(
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.commit({}))
	).rejects.toThrow(new EmptyNoteError());
};

export const syncNoteAndWarehouseInterfaceWithTheDb: TestFunction = async (db) => {
	// NoteInterface should always be able to update (_rev should be in sync)

	// Create and displayName "store" for the note
	let ndn: PossiblyEmpty<string> = EMPTY;

	const note = await db.warehouse().note("note-1").create();
	note.stream()
		.displayName({})
		.subscribe((dn$) => (ndn = dn$));

	// Set the initial name for the note
	note.setName({}, "Note name");
	await waitFor(() => {
		expect(ndn).toEqual("Note name");
	});

	// Update the name from a different instance, simulating an outside update
	await db.warehouse().note("note-1").setName({}, "Note name updated");
	await waitFor(() => {
		expect(ndn).toEqual("Note name updated");
	});

	// Original instance should also be able to update the name (should have the correct _rev)
	note.setName({}, "Note name updated again");
	await waitFor(() => {
		expect(ndn).toEqual("Note name updated again");
	});

	// The note interface should be in sync with the db
	// We test this by instantianting a new note interface for the same note and checking equality after updates
	const noteInst2 = db.warehouse().note("note-1");
	await noteInst2.addVolumes({ isbn: "11111111", quantity: 2, warehouseId: versionId("warehouse-1") });

	await waitFor(() => expect(note).toEqual(noteInst2));

	// Test the same behaviour for the warehouse interface
	const wInst1 = db.warehouse("warehosue-1");
	const wInst2 = db.warehouse("warehosue-1");

	await wInst2.setName({}, "Warehouse 1's name");

	await waitFor(() => expect(wInst1).toEqual(wInst2));
};

// #region helpers
// Legacy types used for more convenient testing of (updated) Map values
// eslint-disable-next-line @typescript-eslint/ban-types
type NavListEntry<A = {}> = { id: string; displayName: string } & A;

/** Old in note list - an array instead of currently used Map */
type InNoteList = NavListEntry<{ notes: NavListEntry[] }>[];

/** Volume stock client with 'availableWarehouses' being NavListEntry */
type VolumeStockClientOld = Omit<VolumeStockClient, "availableWarehouses"> & { availableWarehouses?: NavListEntry[] };

// Functions used to convert the new Map types to the legacy ones (for easier testing)
const navMapToNavList = (navMap: NavMap): NavListEntry[] => [...navMap].map(([id, { displayName }]) => ({ id, displayName }));

const inNoteMapToInNoteList = (inNoteMap: InNoteMap): InNoteList =>
	[...inNoteMap].map(([id, { displayName, notes }]) => ({ id, displayName, notes: navMapToNavList(notes) }));

const volumeStockClientToVolumeStockClientOld = ({ availableWarehouses, ...vsc }: VolumeStockClient): VolumeStockClientOld => ({
	...vsc,
	...(availableWarehouses ? { availableWarehouses: navMapToNavList(availableWarehouses) } : {})
});
// #endregion
