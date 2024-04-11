/* eslint-disable no-case-declarations */
import { beforeEach, describe, expect, test } from "vitest";
import { BehaviorSubject, firstValueFrom, switchMap } from "rxjs";
import { Search } from "js-search";

import { NoteState, testUtils, VolumeStock } from "@librocco/shared";

import { DocType } from "@/enums";

import { BookEntry, InNoteMap, NavMap, VersionString, VolumeStockClient, WarehouseData } from "@/types";

import * as implementations from "@/implementations/inventory";

import { NoWarehouseSelectedError, OutOfStockError, TransactionWarehouseMismatchError } from "@/errors";

import { createVersioningFunction } from "@/utils/misc";
import { newTestDB } from "@/__testUtils__/db";

import { fiftyEntries } from "./data";

const { waitFor } = testUtils;

/**
 * We're using EMPTY as a symbol, rather than 'undefined' or 'null' to be able to differentiate,
 * with absolute certainty, between the stream not emitting anything and the stream emitting something.
 */
const EMPTY = Symbol("empty");
type PossiblyEmpty<T> = typeof EMPTY | T;

// Using 'describe.each' allows us to run tests against each version of the db interface implementation.
const schema = Object.entries(implementations).map(([version, getDB]) => ({ version, getDB }));
describe.each(schema)("Inventory unit tests: $version", ({ version, getDB }) => {
	let db = newTestDB(getDB);
	const versionId = createVersioningFunction(version as VersionString);

	// Initialise a new db for each test
	beforeEach(async () => {
		db = newTestDB(getDB);
		await db.init();
	});

	// Base functionality
	test("standardApi", async () => {
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
	});

	test("warehouseDiscount", async () => {
		const wh1 = await db.warehouse("wh1").create();

		let discount: PossiblyEmpty<number> = EMPTY;
		wh1
			.stream()
			.discount({})
			.subscribe((d) => (discount = d));

		// When the warehouse is created, should have a default discount of 0.
		await waitFor(() => expect(discount).toEqual(0));

		// Should allow update and reflect in the stream
		await wh1.setDiscount({}, 10);
		await waitFor(() => expect(discount).toEqual(10));

		// Check that the instance updates as well
		const dataCheck = await wh1.get();
		expect(dataCheck?.discountPercentage).toEqual(10);

		// Should block the update if updating to the same value
		const { _rev: rev1 } = (await wh1.get()) || {};

		await wh1.setDiscount({}, 10);
		const { _rev: rev2 } = (await wh1.get()) || {};
		// The rev being the same tells us that no update took place
		expect(rev2).toEqual(rev1);
	});

	test("getEntriesQueries", async () => {
		// Set up warehouses
		const defaultWh = await db.warehouse().create();
		const wh1 = await db
			.warehouse("wh1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"));
		// TODO: we should really check this: sometimes, the instance doesn't update between set name and set discount
		await wh1.setDiscount({}, 10);

		// Check for note
		const note = await wh1.note().create();
		await note.addVolumes({ isbn: "0123456789", quantity: 2 }, { isbn: "11111111", quantity: 4 });
		const entries = await note.getEntries({});
		expect([...entries]).toEqual([
			{ isbn: "0123456789", quantity: 2, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1", warehouseDiscount: 10 },
			{ isbn: "11111111", quantity: 4, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1", warehouseDiscount: 10 }
		]);

		// Check for warehouse
		// Note is not yet committed, so no entries should be returned.
		let wh1Entries = await wh1.getEntries({});
		expect([...wh1Entries]).toEqual([]);
		await note.commit({});
		wh1Entries = await wh1.getEntries({});
		expect([...wh1Entries]).toEqual([
			{ isbn: "0123456789", quantity: 2, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1", warehouseDiscount: 10 },
			{ isbn: "11111111", quantity: 4, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1", warehouseDiscount: 10 }
		]);

		// Should work all the same for the default warehouse
		const defaultWhEntries = await defaultWh.getEntries({});
		expect([...defaultWhEntries]).toEqual([
			{ isbn: "0123456789", quantity: 2, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1", warehouseDiscount: 10 },
			{ isbn: "11111111", quantity: 4, warehouseId: versionId("wh1"), warehouseName: "Warehouse 1", warehouseDiscount: 10 }
		]);
	});

	test("noteTransactionOperations", async () => {
		// Set up two warehouses (with display names) and an outbound note
		const [wh1, wh2] = await Promise.all([db.warehouse("wh1").create(), db.warehouse("wh2").create()]);
		await Promise.all([wh1.setName({}, "Warehouse 1"), wh2.setName({}, "Warehouse 2")]);

		// There are no books in stock so 'availableWarehouses' will always be empty
		const availableWarehouses: NavListEntry[] = [];

		// We're testing against an outbound note as it lets us test against more robust functionality (different warehouses and such)
		const note = await db.warehouse().note().create();

		// Subscribe to entries to receive updates
		let entries: PossiblyEmpty<VolumeStockClientOld[]> = EMPTY;
		note
			.stream()
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
				{
					isbn: "0123456789",
					quantity: 2,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 3,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 4,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
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
				{
					isbn: "0123456789",
					quantity: 5,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 4,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Update transaction should overwrite the existing transaction (and not confuse it with the same isbn, but different warehouse)
		await note.updateTransaction({ isbn: "11111111", warehouseId: wh1._id }, { isbn: "11111111", quantity: 8, warehouseId: wh1._id });

		await waitFor(() => {
			expect(entries).toEqual([
				{
					isbn: "0123456789",
					quantity: 5,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 8,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Update transaction should be able to update warehouseId for a transaction
		await note.updateTransaction({ isbn: "11111111" }, { isbn: "11111111", quantity: 10, warehouseId: "wh3" });
		await waitFor(() => {
			expect(entries).toEqual([
				{
					isbn: "0123456789",
					quantity: 5,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 8,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 10,
					warehouseId: versionId("wh3"),
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Updating two transaction with the same isbn to the same warehouse should merge the two (aggregate the quantity)
		await note.updateTransaction(
			{ isbn: "11111111", warehouseId: versionId("wh3") },
			{ isbn: "11111111", quantity: 10, warehouseId: versionId(wh1._id) }
		);
		await waitFor(() => {
			expect(entries).toEqual([
				{
					isbn: "0123456789",
					quantity: 5,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					isbn: "11111111",
					quantity: 18,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Updating transaction with not-matched 'matchTxn' should be a noop
		await note.updateTransaction(
			{ isbn: "11111111", warehouseId: versionId("wh3") },
			{ isbn: "11111111", quantity: 10, warehouseId: versionId(wh1._id) }
		);
		const entriesSnapshot = await note
			.getEntries({})
			.then((entries) => [...entries].map((e) => volumeStockClientToVolumeStockClientOld({ ...e, availableWarehouses: new Map() })));
		expect([...entriesSnapshot]).toEqual([
			{
				isbn: "0123456789",
				quantity: 5,
				warehouseId: versionId(wh1._id),
				warehouseName: "Warehouse 1",
				availableWarehouses,
				warehouseDiscount: 0
			},
			{
				isbn: "11111111",
				quantity: 18,
				warehouseId: versionId(wh1._id),
				warehouseName: "Warehouse 1",
				availableWarehouses,
				warehouseDiscount: 0
			}
		]);

		// Remove transaction should remove the transaction (and not confuse it with the same isbn, but different warehouse)
		await note.removeTransactions({ isbn: "0123456789", warehouseId: wh1._id }, { isbn: "11111111", warehouseId: "wh3" });
		await waitFor(() => {
			expect(entries).toEqual([
				{
					isbn: "11111111",
					quantity: 18,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Running remove transaction should be a no-op if the transaction doesn't exist
		await note.removeTransactions({ isbn: "12345678", warehouseId: versionId(wh1._id) });
		await waitFor(() => {
			expect(entries).toEqual([
				{
					isbn: "11111111",
					quantity: 18,
					warehouseId: versionId(wh1._id),
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});
	});

	test("streamNoteValuesAccordingToSpec", async () => {
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
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
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
				fiftyEntries
					.slice(0, 10)
					.map((e) => ({ ...e, warehouseId: versionId("test-warehouse"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
			);
			expect(entries.total).toEqual(20);
			expect(entries.totalPages).toEqual(2);
		});
		// Paginate to the next page
		paginate(1);
		await waitFor(() => {
			expect(entries.rows).toEqual(
				fiftyEntries
					.slice(10, 20)
					.map((e) => ({ ...e, warehouseId: versionId("test-warehouse"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
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
				{ ...updateTxn, warehouseName: "New Warehouse", warehouseDiscount: 0 },
				...fiftyEntries
					.slice(11, 20)
					.map((e) => ({ ...e, warehouseId: versionId("test-warehouse"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
			])
		);

		// Warehouse discount update should be reflected in the note entries stream
		await db.warehouse("test-warehouse").setDiscount({}, 10);
		await waitFor(() =>
			expect(entries.rows).toEqual([
				{ ...updateTxn, warehouseName: "New Warehouse", warehouseDiscount: 10 },
				...fiftyEntries
					.slice(11, 20)
					.map((e) => ({ ...e, warehouseId: versionId("test-warehouse"), warehouseName: "New Warehouse", warehouseDiscount: 10 }))
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
	});

	test("outboundNoteAvailableWarehouses", async () => {
		// Create two warehouses to work with
		const wh1 = await db
			.warehouse("wh-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"));
		const wh2 = await db
			.warehouse("wh-2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"));

		// Create an outbound note
		const note = await db.warehouse().note().create();

		let entries: PossiblyEmpty<VolumeStock[]> = EMPTY;
		note
			.stream()
			.entries({})
			.subscribe(({ rows }) => (entries = rows.map(volumeStockClientToVolumeStockClientOld)));

		// No transactions are added
		await waitFor(() => expect(entries).toEqual([]));

		// Add a tranasction with isbn not available in any warehouse
		await note.addVolumes({ isbn: "1234567890", quantity: 1 });

		// Should display the transaction, but no 'availableWarehouses'
		await waitFor(() =>
			expect(entries).toEqual([
				{ isbn: "1234567890", quantity: 1, warehouseId: "", warehouseName: "not-found", availableWarehouses: [], warehouseDiscount: 0 }
			])
		);

		// Add a book to the first warehouse
		await wh1
			.note()
			.create()
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }))
			.then((n) => n.commit({}));

		// 'availableWarehouses' (in outbound note transaction) should display the first warehouse
		await waitFor(() =>
			expect(entries).toEqual([
				{
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [{ id: versionId("wh-1"), displayName: "Warehouse 1" }],
					warehouseDiscount: 0
				}
			])
		);

		// Add the same book to the second warehouse
		await wh2
			.note()
			.create()
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }))
			.then((n) => n.commit({}));

		// 'availableWarehouses' (in outbound note transaction) should now display both warehouses
		await waitFor(() =>
			expect(entries).toEqual([
				{
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [
						{ id: versionId("wh-1"), displayName: "Warehouse 1" },
						{ id: versionId("wh-2"), displayName: "Warehouse 2" }
					],
					warehouseDiscount: 0
				}
			])
		);

		// Add a different book to the first warehouse
		await wh1
			.note()
			.create()
			.then((n) => n.addVolumes({ isbn: "1111111111", quantity: 2 }))
			.then((n) => n.commit({}));

		// Adding the same book to the outbound note should display only the first warehouse
		await note.addVolumes({ isbn: "1111111111", quantity: 1 });
		await waitFor(() =>
			expect(entries).toEqual([
				{
					isbn: "1111111111",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [{ id: versionId("wh-1"), displayName: "Warehouse 1" }],
					warehouseDiscount: 0
				},
				{
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [
						{ id: versionId("wh-1"), displayName: "Warehouse 1" },
						{ id: versionId("wh-2"), displayName: "Warehouse 2" }
					],
					warehouseDiscount: 0
				}
			])
		);
	});
	test("outboundNoteDefaultWarehouse", async () => {
		// Create two warehouses to work with
		await db
			.warehouse("wh-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"));
		await db
			.warehouse("wh-2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"));

		// Create an outbound note
		const note = await db.warehouse().note().create();
		await note.setDefaultWarehouse({}, "v1/wh-2");

		let entries: PossiblyEmpty<VolumeStock[]> = EMPTY;
		note
			.stream()
			.entries({})
			.subscribe(({ rows }) => (entries = rows.map(volumeStockClientToVolumeStockClientOld)));

		// No transactions are added
		await waitFor(() => expect(entries).toEqual([]));

		// Add a tranasction
		await note.addVolumes({ isbn: "1234567890", quantity: 1 });

		// Should display the transaction with the default warehouse as warehouseId
		await waitFor(() =>
			expect(entries).toEqual([
				{
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "v1/wh-2",
					warehouseName: "Warehouse 2",
					availableWarehouses: [],
					warehouseDiscount: 0
				}
			])
		);

		await note.setDefaultWarehouse({}, "v1/wh-1");

		await note.addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1234567770", quantity: 1 });

		// Should display the second transaction with the default warehouse as warehouseId
		// and the first interaction should keep its default warehouseId
		await waitFor(() =>
			expect(entries).toEqual([
				{
					isbn: "1234567770",
					quantity: 1,
					warehouseId: "v1/wh-1",
					warehouseName: "Warehouse 1",
					availableWarehouses: [],
					warehouseDiscount: 0
				},
				{
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "v1/wh-1",
					warehouseName: "Warehouse 1",
					availableWarehouses: [],
					warehouseDiscount: 0
				},
				{
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "v1/wh-2",
					warehouseName: "Warehouse 2",
					availableWarehouses: [],
					warehouseDiscount: 0
				}
			])
		);
	});

	test("streamWarehouseStock", async () => {
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
				{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }
			]);
			expect(defaultWarehouseStock).toEqual([
				{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }
			]);
			expect(warehouse2Stock).toEqual([]);
		});

		// Adding books to warehouse 2 should display changes in warehouse 2 and aggregate the stock of both warehouses in the default warehouse stock stream
		const note2 = warehouse2.note();
		await note2.addVolumes({ isbn: "0123456789", quantity: 3 });
		await note2.commit({});

		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }
			]);
			expect(defaultWarehouseStock).toEqual([
				{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse", warehouseDiscount: 0 },
				{
					isbn: "0123456789",
					quantity: 3,
					warehouseId: versionId("warehouse-2"),
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
			expect(warehouse2Stock).toEqual([
				{
					isbn: "0123456789",
					quantity: 3,
					warehouseId: versionId("warehouse-2"),
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Non committed notes should not be taken into account (when calculating the stock)
		const note3 = warehouse1.note();
		await note3.addVolumes({ isbn: "0123456789", quantity: 3 });
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{ isbn: "0123456789", quantity: 3, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }
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
				{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }
			]);
			expect(defaultWarehouseStock).toEqual([
				{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "New Warehouse", warehouseDiscount: 0 },
				{
					isbn: "0123456789",
					quantity: 2,
					warehouseId: versionId("warehouse-2"),
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
			expect(warehouse2Stock).toEqual([
				{
					isbn: "0123456789",
					quantity: 2,
					warehouseId: versionId("warehouse-2"),
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Updating a warehouse name should be reflected in the stock stream
		await warehouse1.setName({}, "Warehouse 1");
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1", warehouseDiscount: 0 }
			]);
			expect(defaultWarehouseStock).toEqual([
				{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1", warehouseDiscount: 0 },
				{
					isbn: "0123456789",
					quantity: 2,
					warehouseId: versionId("warehouse-2"),
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Updating a warehouse discount should be reflected in the stock stream
		await warehouse1.setDiscount({}, 20);
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1", warehouseDiscount: 20 }
			]);
			expect(defaultWarehouseStock).toEqual([
				{ isbn: "0123456789", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1", warehouseDiscount: 20 },
				{
					isbn: "0123456789",
					quantity: 2,
					warehouseId: versionId("warehouse-2"),
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
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
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
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
				{ isbn: "11111111", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1", warehouseDiscount: 20 }
			]);
			expect(defaultWarehouseStock).toEqual([
				{
					isbn: "0123456789",
					quantity: 2,
					warehouseId: versionId("warehouse-2"),
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				},
				{ isbn: "11111111", quantity: 1, warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1", warehouseDiscount: 20 }
			]);
		});
	});

	test("warehousePaginationStream", async () => {
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
		const entriesWithPagination = currentPage.pipe(switchMap((page) => warehouse.stream().entries({}, page, 10)));
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
				fiftyEntries
					.slice(0, 10)
					.map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
			);
			expect(entries.total).toEqual(20);
			expect(entries.totalPages).toEqual(2);
		});

		// Paginate to the second page
		paginate(1);
		await waitFor(() => {
			expect(entries.rows).toEqual(
				fiftyEntries
					.slice(10, 20)
					.map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
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
				fiftyEntries
					.slice(10, 20)
					.map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
			);
			expect(entries.total).toEqual(28);
			expect(entries.totalPages).toEqual(3);
		});

		// Removing items from the current page should update the stream,
		// still showing 10 items, filling the gap with items from the next page.
		await db
			.warehouse()
			.note()
			// Adding some of the transactions to an outbound note (same quantity) should simply remove said books from stock
			.addVolumes(...fiftyEntries.slice(10, 19).map((v) => ({ ...v, warehouseId: "wh1" })))
			.then((n) => n.commit({}));
		await waitFor(() => {
			expect(entries.rows).toEqual(
				fiftyEntries
					.slice(19, 28)
					.map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
			);
			expect(entries.total).toEqual(19);
			expect(entries.totalPages).toEqual(2);
		});

		// If no itemsPerPage provided, should stream all items
		const allEntries = await firstValueFrom(warehouse.stream().entries({}));
		// There currently are 19 entries in the warehouse => 28 added - 19 removed
		expect(allEntries.rows.length).toEqual(19);
		expect(allEntries.rows).toEqual(
			// We've removed entries 10-18, in the previous step
			fiftyEntries
				.slice(0, 10)
				.concat(fiftyEntries.slice(19, 28))
				.map((v) => ({ ...v, warehouseId: versionId("wh1"), warehouseName: "New Warehouse", warehouseDiscount: 0 }))
		);
		// Should still stream predictable pagination stats
		expect(allEntries.total).toEqual(19);
		expect(allEntries.totalPages).toEqual(1);
	});

	test("warehouseDataMapStream", async () => {
		const wl$ = db.stream().warehouseMap({});
		let warehouseDataMap: PossiblyEmpty<Array<Pick<WarehouseData, "displayName" | "discountPercentage"> & { id: string }>> = EMPTY;
		wl$.subscribe(
			(wm) => (warehouseDataMap = [...wm].map(([id, { displayName, discountPercentage }]) => ({ id, displayName, discountPercentage })))
		);

		// The default warehouse should be created automatically
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([{ id: versionId("0-all"), displayName: "All", discountPercentage: 0 }]);
		});
		const warehouse = await db.warehouse("new-warehouse").create();
		await waitFor(() => {
			// The default ("0-all") warehouse should be created as well (when the first warehouse is created)
			expect(warehouseDataMap).toEqual([
				{ id: versionId("0-all"), displayName: "All", discountPercentage: 0 },
				{ id: versionId("new-warehouse"), displayName: "New Warehouse", discountPercentage: 0 }
			]);
		});

		// Updating a warehouse name, should be reflected in warehouseList stream as well
		await warehouse.setName({}, "New Name");
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([
				{ id: versionId("0-all"), displayName: "All", discountPercentage: 0 },
				{ id: versionId("new-warehouse"), displayName: "New Name", discountPercentage: 0 }
			]);
		});

		// Updating a warehouse discount, should be reflected in warehouseList stream as well
		await warehouse.setDiscount({}, 10);
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([
				{ id: versionId("0-all"), displayName: "All", discountPercentage: 0 },
				{ id: versionId("new-warehouse"), displayName: "New Name", discountPercentage: 10 }
			]);
		});

		// Adding a note (for instance) shouldn't affect the warehouse list
		await warehouse.note().create();
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([
				{ id: versionId("0-all"), displayName: "All", discountPercentage: 0 },
				{ id: versionId("new-warehouse"), displayName: "New Name", discountPercentage: 10 }
			]);
		});
	});

	test("inNotesStream", async () => {
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
	});

	test("outNotesStream", async () => {
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
	});

	test("sequenceWarehouseDesignDocument", async () => {
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
	});

	test("sequenceNoteDesignDocument", async () => {
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
	});

	test("streamsShouldFallBackToDefaultValueForTheirType", async () => {
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
			.warehouseMap({})
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
	});

	test("booksInterface", async () => {
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

		// Insert test
		await Promise.all([booksInterface.upsert([{ ...book1 }, { ...book2 }])]);

		const booksFromDb = await booksInterface.get([book1.isbn, book2.isbn]);

		expect(booksFromDb).toEqual([book1, book2]);

		// Update test
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

		// Stream test
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
	});

	test("publishersStream", async () => {
		// Publishers stream test
		let publishers: PossiblyEmpty<string[]> = EMPTY;
		db.books()
			.streamPublishers({})
			.subscribe((p) => (publishers = p));

		// There are no books in the db, should stream an empty array
		await waitFor(() => expect(publishers).toEqual([]));

		// Adding a new book (with not-yet-registered publisher) should update the publishers stream
		await db.books().upsert([{ isbn: "new-isbn", publisher: "HarperCollins UK" } as BookEntry]);
		await waitFor(() => expect(publishers).toEqual(["HarperCollins UK"]));

		await db.books().upsert([
			{ isbn: "new-isbn-2", publisher: "Oxford" },
			{ isbn: "new-isbn-3", publisher: "Penguin" }
		] as BookEntry[]);
		await waitFor(() => expect(publishers).toEqual(["HarperCollins UK", "Oxford", "Penguin"]));

		// Adding a book with existing publisher should not duplicate the publisher in the stream
		await db.books().upsert([{ isbn: "new-isbn-4", publisher: "Oxford" } as BookEntry]);
		await waitFor(() => expect(publishers).toEqual(["HarperCollins UK", "Oxford", "Penguin"]));
	});

	test("committing of an inbound note", async () => {
		// The db should not allow for committing of inbound notes with transactions belonging
		// to warehouse different then note's parent warehouse.
		const warehouse1 = await db.warehouse("warehouse-1").create();
		const note1 = await warehouse1.note().create();
		await note1.addVolumes(
			{ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" },
			{ isbn: "22222222", quantity: 2, warehouseId: "warehouse-2" }
		);

		await expect(note1.commit({})).rejects.toThrow(
			new TransactionWarehouseMismatchError(versionId("warehouse-1"), [
				{ isbn: "22222222", warehouseId: versionId("warehouse-2"), quantity: 2 }
			])
		);

		// Fix the invalid transactions and commit the note
		await note1
			.updateTransaction({ isbn: "22222222", warehouseId: "warehouse-2" }, { isbn: "22222222", warehouseId: "warehouse-1", quantity: 2 })
			.then((n) => n.commit({}));

		await waitFor(() => note1.get().then((n) => expect(n!.committed).toEqual(true)));
	});

	test("committing of an outbound note", async () => {
		// Create two warehouses and add some stock
		const [wh1, wh2] = await Promise.all([
			db
				.warehouse("warehouse-1")
				.create()
				.then((w) => w.setName({}, "Warehouse 1")),
			db
				.warehouse("warehouse-2")
				.create()
				.then((w) => w.setName({}, "Warehouse 2"))
		]);
		await Promise.all([
			wh1
				.note()
				.addVolumes({ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" })
				.then((n) => n.commit({})),
			wh2
				.note()
				.addVolumes({ isbn: "22222222", quantity: 2, warehouseId: "warehouse-2" })
				.then((n) => n.commit({}))
		]);

		// Create an outbound note with invalid transactions
		const note = await db.warehouse().note().addVolumes(
			// A valid transaction - selected warehouse has enough stock
			{ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" },
			// Invalid transaction - no warehouse selected
			{ isbn: "22222222", quantity: 2 },
			// Invalid transaction - selected warehouse doesn't have enough stock
			{ isbn: "22222222", quantity: 3, warehouseId: "warehouse-2" },
			// Invalid transaction - selected warehouse has no stock
			{ isbn: "11111111", quantity: 1, warehouseId: "warehouse-2" }
		);

		// Can't commit the note as one transaction has no warehouse selected
		await expect(note.commit({})).rejects.toThrow(new NoWarehouseSelectedError([{ isbn: "22222222", quantity: 2, warehouseId: "" }]));

		// Fix warehouse selection
		await note.updateTransaction({ isbn: "22222222" }, { isbn: "22222222", quantity: 2, warehouseId: "warehouse-1" });
		// Current note transactions:
		// - "11111111": 2 (warehouse-1) - valid
		// - "22222222": 2 (warehouse-1) - invlid - no "22222222" in warehouse-1 stock
		// - "22222222": 3 (warehouse-2) - invalid - not enough stock in warehouse-2
		// - "11111111": 1 (warehouse-2) - invalid - no "11111111" in warehouse-2 stock

		// Can't commit the note as it contains out-of-stock transactions
		await expect(note.commit({})).rejects.toThrow(
			new OutOfStockError([
				{ isbn: "11111111", warehouseId: versionId("warehouse-2"), warehouseName: "Warehouse 2", quantity: 1, available: 0 },
				{ isbn: "22222222", warehouseId: versionId("warehouse-1"), warehouseName: "Warehouse 1", quantity: 2, available: 0 },
				{ isbn: "22222222", warehouseId: versionId("warehouse-2"), warehouseName: "Warehouse 2", quantity: 3, available: 2 }
			])
		);

		// Fix the note - remove excess quantity/transactions
		await note.removeTransactions({ isbn: "22222222", warehouseId: "warehouse-1" }, { isbn: "11111111", warehouseId: "warehouse-2" });
		await note.updateTransaction(
			{ isbn: "22222222", warehouseId: "warehouse-2" },
			{ isbn: "22222222", quantity: 2, warehouseId: "warehouse-2" }
		);
		// Current note transactions:
		// - "11111111": 2 (warehouse-1) - valid
		// - "22222222": 2 (warehouse-2) - valid

		await note.commit({});
		await waitFor(() => note.get().then((n) => expect(n!.committed).toEqual(true)));
	});

	test("reconcile outbound notes", async () => {
		// Create three warehouses and add some books
		const warehouse1 = db.warehouse("warehouse-1");
		const warehouse2 = db.warehouse("warehouse-2");
		const warehouse3 = db.warehouse("warehouse-3");

		await Promise.all([warehouse1.create(), warehouse2.create(), warehouse3.create()]);

		// Add some books to warehouses
		await Promise.all([
			warehouse1
				.note()
				.addVolumes(
					{ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" },
					{ isbn: "22222222", quantity: 3, warehouseId: "warehouse-1" }
				)
				.then((n) => n.commit({})),
			warehouse2
				.note()
				.addVolumes({ isbn: "11111111", quantity: 1, warehouseId: "warehouse-2" })
				.then((n) => n.commit({})),
			warehouse3
				.note()
				.addVolumes({ isbn: "11111111", quantity: 1, warehouseId: "warehouse-3" })
				.then((n) => n.commit({}))
		]);

		// Current state:
		//
		// 11111111, warehouse1, 2
		// 22222222, warehouse1, 3
		//
		// 11111111, warehouse2, 1
		//
		// 11111111, warehouse3, 1

		// Add books to an outbound note
		const note = await db.warehouse().note().create();
		await note.addVolumes(
			// In-stock - all fine
			{ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" },
			// In-stock - one should remain after the note is committed
			{ isbn: "22222222", quantity: 2, warehouseId: "warehouse-1" },
			// Not-in-stock - reconciliation should add 2, resulting in 0 after the note is committed
			{ isbn: "33333333", quantity: 2, warehouseId: "warehouse-1" },
			// Not-fully-in-stock - reconciliation should add 2, resulting in 0 after the note is committed
			{ isbn: "11111111", quantity: 3, warehouseId: "warehouse-2" },
			// Not-in-stock - reconciliation should add 1, resulting in 0 after the note is committed
			{ isbn: "22222222", quantity: 1, warehouseId: "warehouse-3" }
		);

		// We can't commit the note yet
		try {
			await note.commit({});
		} catch (err) {
			expect(err instanceof OutOfStockError).toEqual(true);
		}

		// Reconcile and commit the note
		await note.reconcile({});
		// We should be able to commit the note now
		await note.commit({});

		// Check remaining stock (all warehouses)
		const stock = await db.warehouse().getEntries({});
		expect([...stock]).toEqual([
			// Stock is missing only the books that were there to begin with (and reduced by the outbond note)
			expect.objectContaining({ isbn: "22222222", quantity: 1, warehouseId: versionId("warehouse-1") }),
			expect.objectContaining({ isbn: "11111111", quantity: 1, warehouseId: versionId("warehouse-3") })
		]);
	});

	test("syncNoteAndWarehouseInterfaceWithTheDb", async () => {
		// NoteInterface should always be able to update (_rev should be in sync)

		// Create and displayName "store" for the note
		let ndn: PossiblyEmpty<string> = EMPTY;

		const note = await db.warehouse().note("note-1").create();
		note
			.stream()
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
	});

	test("bookFetcherPlugin", async () => {
		// The initial book-fetcher plugin should satisfy the 'BookFetcherPlugin' interface
		// with all of its methods being noop
		//
		// Here we're also testing that the api won't explode if no plugin is registered.
		const res1 = await db.plugin("book-fetcher").fetchBookData(["11111111", "22222222"]);
		expect(res1).toEqual([]);

		// Registering a plugin implementation should return that implementation for all subsequent calls
		const impl1 = {
			fetchBookData: async (isbns: string[]) => isbns as any // In practice this should be a BookEntry array
		};
		// Calling the implementation returned after registering the plugin
		const res21 = await db.plugin("book-fetcher").register(impl1).fetchBookData(["11111111", "22222222"]);
		expect(res21).toEqual(["11111111", "22222222"]);
		// Calling the implementation from the next call to .plugin("book-fetcher") - should be the same implementation
		const res22 = await db.plugin("book-fetcher").fetchBookData(["11111111", "22222222"]);
		expect(res22).toEqual(["11111111", "22222222"]);

		// Registering a different implementation should return that implementation for all subsequent calls
		const impl2 = {
			fetchBookData: async (isbns: string[]) => isbns.map((isbn): BookEntry => ({ isbn, title: "Title", price: 0 }))
		};
		// Calling the implementation returned after registering the plugin
		const res31 = await db.plugin("book-fetcher").register(impl2).fetchBookData(["11111111", "22222222"]);
		expect(res31).toEqual([
			{ isbn: "11111111", title: "Title", price: 0 },
			{ isbn: "22222222", title: "Title", price: 0 }
		]);
		// Calling the implementation from the next call to .plugin("book-fetcher") - should be the same implementation
		const res32 = await db.plugin("book-fetcher").fetchBookData(["11111111", "22222222"]);
		expect(res32).toEqual([
			{ isbn: "11111111", title: "Title", price: 0 },
			{ isbn: "22222222", title: "Title", price: 0 }
		]);
	});

	test("receiptPrinter", async () => {
		// We're creating a bunch of transactions to test the receipt
		// taking into account entries which would be omitted in the UI by pagination.
		//
		// Additionally, we're later using this (predictable prices) to test applied discount.
		const transactions = Array(20)
			.fill(null)
			.map((_, i) => ({
				isbn: `transaction-${i}`,
				title: `Transaction ${i}`,
				quantity: 2,
				warehouseId: "wh-1",
				price: (1 + i) * 2
			}));

		// Setup: Create a note and book data for transactions
		const [note] = await Promise.all([
			db
				.warehouse()
				.note()
				.create()
				// Add all transactions to the note
				.then((n) => n.addVolumes(...transactions.map(({ isbn, quantity, warehouseId }) => ({ isbn, quantity, warehouseId })))),
			// Create book data entries for transactions
			db.books().upsert(transactions.map(({ isbn, title, price }) => ({ isbn, title, price })))
		]);

		// Print the note
		let printJobId = await note.printReceipt();
		expect(printJobId).toMatch(/print_queue\/printer-1\/[0-9a-z]+$/);

		// The print job should have been added to the print queue
		let printJob = await db._pouch.get(printJobId);
		expect(printJob).toEqual({
			_id: printJobId,
			_rev: expect.any(String),
			docType: DocType.PrintJob,
			printer_id: "printer-1",
			status: "PENDING",
			items: transactions.map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price })),
			// Prices series: 2, 4, ..., (n * 2) | n = 20
			// S(n) = 2 + 4 + ... + (n * 2) | n = 20
			// S(n) = n * (a1 + an) / 2
			// S(n) = 20 * (2 + 40) / 2 = 420
			//
			// Quantities: 2 (for each entry)
			// Sum = S(n) * 2 = 840
			total: 840,
			timestamp: expect.any(Number)
		});

		// Add a discount to wh-1
		await db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setDiscount({}, 50));

		// Print the note again
		printJobId = await note.printReceipt();

		// The print job should have been added to the print queue with discounted prices
		printJob = await db._pouch.get(printJobId);
		expect(printJob).toEqual({
			_id: printJobId,
			_rev: expect.any(String),
			docType: DocType.PrintJob,
			printer_id: "printer-1",
			status: "PENDING",
			items: transactions.map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price: price / 2 })),
			// Prices series: 1, 2, ..., n | n = 20
			// S(n) = 1 + 2 + ... + n | n = 20
			// S(n) = n * (a1 + an) / 2
			// S(n) = 20 * (1 + 20) / 2 = 210
			//
			// Quantities: 2 (for each entry)
			// Sum = S(n) * 2 = 420
			total: 420,
			timestamp: expect.any(Number)
		});

		// Add transactions belonging to different warehouse (no discount should be applied to those)
		//
		// Transactions are the first two from the previous array (they already have a price set with book data), but since
		// they belong to wh-2, no discount will be applied
		await note.addVolumes(...transactions.slice(0, 2).map((txn) => ({ ...txn, warehouseId: "wh-2" })));

		// Print the note again
		printJobId = await note.printReceipt();

		// The print job should have been added to the print queue with discounted prices
		printJob = await db._pouch.get(printJobId);
		expect(printJob).toEqual({
			_id: printJobId,
			_rev: expect.any(String),
			docType: DocType.PrintJob,
			printer_id: "printer-1",
			status: "PENDING",
			items: [
				// wh-1 transactions - with discount applied
				...transactions.map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price: price / 2 })),
				// additional two transactions (wh-2) - no discount applied
				...transactions.slice(0, 2).map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price }))
			],
			// Prices series: 1, 2, ..., n | n = 20
			// S(n) = 1 + 2 + ... + n | n = 20
			// S(n) = n * (a1 + an) / 2
			// S(n) = 20 * (1 + 20) / 2 = 210
			//
			// Quantities: 2 (for each entry)
			// Sum = 2 * ( S(n) + transaction-0-without-discount + transaction-1-without-discount )
			// Sum = 2 * ( S(n) + 2 + 4 ) = 432
			total: 432,
			timestamp: expect.any(Number)
		});
	});

	test("search", async () => {
		// Setup: Add three books to the db
		const lotr = {
			isbn: "11111111",
			title: "The Lord of the Rings: The Return of the King",
			authors: "J.R.R. Tolkien",
			publisher: "Penguin Classics",
			price: 10
		};
		const pets = { isbn: "22222222", title: "Pet Sematary", authors: "Stephen King", publisher: "Oxford University Press", price: 20 };
		const time = {
			isbn: "33333333",
			title: "A Brief History of Time",
			authors: "Stephen Hawking",
			publisher: "Oxford University Press",
			price: 30
		};

		const books = [lotr, pets, time];
		await db.books().upsert(books);

		let index = new Search("isbn");
		db.books()
			.streamSearchIndex()
			.subscribe((i) => (index = i));

		// Search string: "oxford" - should match "Oxford University Press" (regardless of letter casing)
		await waitFor(() => expect(index.search("oxford")).toEqual([pets, time]));

		// Search string: "stephen" - should match "Stephen King" (author) and "Stephen Hawking" (author)
		// expect(index.search("stephen")).toEqual([pets, time]);

		// Search string: "king" - should match both "(...) Return of The King" (title) and "Stephen King" (author)
		await waitFor(() => expect(index.search("king")).toEqual([lotr, pets]));

		// Adding a book to the db should update the index
		const werther = {
			isbn: "44444444",
			title: "The Sorrows of Young Werther",
			authors: "Johann Wolfgang von Goethe",
			publisher: "Penguin Classics",
			price: 40
		};
		await db.books().upsert([werther]);
		await waitFor(() => expect(index.search("Penguin Classics")).toEqual([lotr, werther]));
	});
});

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
