/* eslint-disable no-case-declarations */
import { beforeEach, describe, expect, test } from "vitest";
import { firstValueFrom, toArray } from "rxjs";
import { Search } from "js-search";

import { NoteState, testUtils, VolumeStock } from "@librocco/shared";

import { BookEntry, InNoteMap, NavMap, PastTransactionsMap, SearchIndex, VolumeStockClient, WarehouseData } from "@/types";

import * as implementations from "@/implementations/inventory";

import { NoWarehouseSelectedError, OutOfStockError } from "@/errors";

import { newTestDB } from "@/__testUtils__/db";
import { createSingleSourceBookFetcher } from "@/utils/plugins";

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
describe.each(schema)("Inventory unit tests: $version", ({ getDB }) => {
	let db = newTestDB(getDB);

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
		expect(wh1.id).toEqual("wh1");

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
		expect(note1.id).toBeTruthy();

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
		const { note: note2found, warehouse: warehouse2Found } = (await db.findNote(note2.id)) || {};
		expect(note2found).toEqual({ ...note2, displayName: "New Note (2)" });
		expect(warehouse2Found).toEqual(wh2);

		// Non-existing notes should return undefined.
		// We're manipulating a dynamic id from note2 as id patterns might differ per implementation.
		// replacing last two letters should do the trick.
		const nonExistingId = note2.id.slice(0, -2) + "zz";
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
		const { updatedAt: ua1 } = (await wh1.get()) || {};

		await wh1.setDiscount({}, 10);
		const { updatedAt: ua2 } = (await wh1.get()) || {};

		// The updatedAt being the same tells us that no update took place
		expect(ua1).toEqual(ua2);
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
		await note.addVolumes({}, { isbn: "0123456789", quantity: 2 }, { isbn: "11111111", quantity: 4 });
		const entries = await note.getEntries({});
		expect([...entries]).toEqual([
			{ __kind: "book", isbn: "11111111", quantity: 4, warehouseId: "wh1", warehouseName: "Warehouse 1", warehouseDiscount: 10 },
			{ __kind: "book", isbn: "0123456789", quantity: 2, warehouseId: "wh1", warehouseName: "Warehouse 1", warehouseDiscount: 10 }
		]);

		// Check for warehouse
		// Note is not yet committed, so no entries should be returned.
		let wh1Entries = await wh1.getEntries({});
		expect([...wh1Entries]).toEqual([]);
		await note.commit();
		wh1Entries = await wh1.getEntries({});
		expect([...wh1Entries]).toEqual([
			{
				__kind: "book",
				isbn: "0123456789",
				quantity: 2,
				warehouseId: "wh1",
				warehouseName: "Warehouse 1",
				warehouseDiscount: 10
			},
			{ __kind: "book", isbn: "11111111", quantity: 4, warehouseId: "wh1", warehouseName: "Warehouse 1", warehouseDiscount: 10 }
		]);

		// Should work all the same for the default warehouse
		const defaultWhEntries = await defaultWh.getEntries({});
		expect([...defaultWhEntries]).toEqual([
			{
				__kind: "book",
				isbn: "0123456789",
				quantity: 2,
				warehouseId: "wh1",
				warehouseName: "Warehouse 1",
				warehouseDiscount: 10
			},
			{ __kind: "book", isbn: "11111111", quantity: 4, warehouseId: "wh1", warehouseName: "Warehouse 1", warehouseDiscount: 10 }
		]);
	});

	test("note.addVolumes", async () => {
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
			{},
			{ isbn: "0123456789", quantity: 2, warehouseId: wh1.id },
			// Having the same isbn for different warehouses will come in handy when testing update/remove transaction
			{ isbn: "11111111", quantity: 4, warehouseId: wh1.id },
			{ isbn: "11111111", quantity: 3 }
		);

		// Transactions are ordered in a reverse order of being added/aggregated
		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 3,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 4,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Adding volumes to the same ISBN/warheouseId pair should simply aggregate the quantities
		await note.addVolumes(
			{},
			// The add volumes operation should not confuse the transaction with the same isbn, but different warehouse
			{ isbn: "0123456789", quantity: 3, warehouseId: wh1.id },
			// This should also work if warehouse is not provided (falls back to "", in case of outbound note)
			{ isbn: "11111111", quantity: 7 }
		);
		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 4,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Transactions added to inbound notes should have the warehouseId set to the warehouse's id (regerdless of input)
		const inNote = await db
			.warehouse("wh1")
			.note()
			.create()
			.then((n) => n.addVolumes({}, { isbn: "0123456789", quantity: 5, warehouseId: "wh2" }));
		const inNoteEntries = await inNote.getEntries({});
		expect(inNoteEntries).toEqual([
			{ __kind: "book", isbn: "0123456789", quantity: 5, warehouseId: "wh1", warehouseName: "Warehouse 1", warehouseDiscount: 0 }
		]);

		// Adding a custom item should assign a random id to the item
		await note.addVolumes({}, { __kind: "custom", title: "Custom Item", price: 10 });
		await waitFor(() => {
			expect(entries).toEqual([
				{ id: expect.any(String), __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 4,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Adding another custom item should assign a different random id
		//
		// Get the id of the first custom item
		const customItemId = await note
			.getEntries({})
			.then((entries) => [...entries].find((e): e is VolumeStockClient<"custom"> => e.__kind === "custom")!.id);
		await note.addVolumes({}, { __kind: "custom", title: "Custom Item 2", price: 20 });
		await waitFor(() => {
			expect(entries).toEqual([
				{ id: expect.any(String), __kind: "custom", title: "Custom Item 2", price: 20 },
				{ id: expect.any(String), __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 4,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});
		const newCustomItemId = await note
			.getEntries({})
			.then(
				(entries) =>
					[...entries].filter((e): e is VolumeStockClient<"custom"> => e.__kind === "custom").find((e) => e.title === "Custom Item 2")!.id
			);
		expect(newCustomItemId).not.toEqual(customItemId);

		// Regression: should overwrite the id (always generate a new id) on add volumes - the custom item form assigns 'undefined' to id - this caused a regression
		// we're testing for here
		await note.addVolumes({}, { __kind: "custom", id: undefined, title: "Custom Item 3", price: 20 });
		await waitFor(() => {
			expect(entries).toEqual([
				{ id: expect.any(String), __kind: "custom", title: "Custom Item 3", price: 20 },
				{ id: expect.any(String), __kind: "custom", title: "Custom Item 2", price: 20 },
				{ id: expect.any(String), __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 4,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});
	});

	test("note.updateTransaction", async () => {
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

		// Setup is the same as the result of previous test (tests were broken down due to log run times and growing number of assertions)
		await note.addVolumes(
			{},
			{ __kind: "book", isbn: "0123456789", quantity: 5, warehouseId: wh1.id },
			{ __kind: "book", isbn: "11111111", quantity: 10, warehouseId: "" },
			{ __kind: "book", isbn: "11111111", quantity: 4, warehouseId: wh1.id },
			{ __kind: "custom", id: "custom-item-1", title: "Custom Item", price: 10 },
			{ __kind: "custom", id: "custom-item-2", title: "Custom Item 2", price: 20 }
		);

		// Initial stream should be empty
		await waitFor(() => {
			expect(entries).toEqual([
				{ id: "custom-item-2", __kind: "custom", title: "Custom Item 2", price: 20 },
				{ id: "custom-item-1", __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 4,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Update transaction should overwrite the existing transaction (and not confuse it with the same isbn, but different warehouse)
		await note.updateTransaction(
			{},
			{ __kind: "book", isbn: "11111111", warehouseId: wh1.id },
			{ __kind: "book", isbn: "11111111", quantity: 8, warehouseId: wh1.id }
		);

		await waitFor(() => {
			expect(entries).toEqual([
				{ id: "custom-item-2", __kind: "custom", title: "Custom Item 2", price: 20 },
				{ id: "custom-item-1", __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 8,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 10,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Update transaction should be able to update warehouseId for a transaction (warehouseId falls back to "" if not specified otherwise)
		await note.updateTransaction({}, { isbn: "11111111" }, { isbn: "11111111", quantity: 10, warehouseId: "wh3" });
		await waitFor(() => {
			expect(entries).toEqual([
				{ id: "custom-item-2", __kind: "custom", title: "Custom Item 2", price: 20 },
				{ id: "custom-item-1", __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 8,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 10,
					warehouseId: "wh3",
					warehouseName: "not-found",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Updating two transaction with the same isbn to the same warehouse should merge the two (aggregate the quantity)
		await note.updateTransaction({}, { isbn: "11111111", warehouseId: "wh3" }, { isbn: "11111111", quantity: 10, warehouseId: wh1.id });
		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 18,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{ id: "custom-item-2", __kind: "custom", title: "Custom Item 2", price: 20 },
				{ id: "custom-item-1", __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Updating transaction with not-matched 'matchTxn' should be a noop
		await note.updateTransaction({}, { isbn: "11111111", warehouseId: "wh3" }, { isbn: "11111111", quantity: 10, warehouseId: wh1.id });
		await waitFor(() =>
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 18,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{ id: "custom-item-2", __kind: "custom", title: "Custom Item 2", price: 20 },
				{ id: "custom-item-1", __kind: "custom", title: "Custom Item", price: 10 },
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			])
		);

		// Updating of custom items should be possible using the custom item id
		await note.updateTransaction({}, "custom-item-1", { __kind: "custom", title: "Custom Item", price: 15 });
		await note.updateTransaction({}, "custom-item-2", { __kind: "custom", title: "Updated 2nd item", price: 25 });

		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 18,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{ id: "custom-item-2", __kind: "custom", title: "Updated 2nd item", price: 25 },
				{ id: "custom-item-1", __kind: "custom", title: "Custom Item", price: 15 },
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});
	});

	test("note.removeTransaction", async () => {
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

		// Setup is the same as the result of previous test (tests were broken down due to log run times and growing number of assertions)
		await note.addVolumes(
			{},
			{ __kind: "book", isbn: "0123456789", quantity: 5, warehouseId: wh1.id },
			{ __kind: "book", isbn: "11111111", quantity: 18, warehouseId: wh1.id },
			{ __kind: "custom", id: "custom-item-1", title: "Custom Item", price: 15 },
			{ __kind: "custom", id: "custom-item-2", title: "Updated 2nd item", price: 25 }
		);

		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "custom",
					id: "custom-item-2",
					title: "Updated 2nd item",
					price: 25
				},
				{
					__kind: "custom",
					id: "custom-item-1",
					title: "Custom Item",
					price: 15
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 18,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 5,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Remove transaction should remove the transaction (and not confuse it with the same isbn, but different warehouse)
		await note.removeTransactions({}, { isbn: "0123456789", warehouseId: wh1.id }, { isbn: "11111111", warehouseId: "wh3" });
		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "custom",
					id: "custom-item-2",
					title: "Updated 2nd item",
					price: 25
				},
				{
					__kind: "custom",
					id: "custom-item-1",
					title: "Custom Item",
					price: 15
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 18,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Running remove transaction should be a no-op if the transaction doesn't exist
		await note.removeTransactions({}, { isbn: "12345678", warehouseId: wh1.id });
		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "custom",
					id: "custom-item-2",
					title: "Updated 2nd item",
					price: 25
				},
				{
					__kind: "custom",
					id: "custom-item-1",
					title: "Custom Item",
					price: 15
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 18,
					warehouseId: wh1.id,
					warehouseName: "Warehouse 1",
					availableWarehouses,
					warehouseDiscount: 0
				}
			]);
		});

		// Should be able to remove custom items using their id
		await note.removeTransactions({}, "custom-item-2");
		await waitFor(() => {
			expect(entries).toEqual([
				{
					__kind: "custom",
					id: "custom-item-1",
					title: "Custom Item",
					price: 15
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 18,
					warehouseId: wh1.id,
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
		} = {
			rows: EMPTY,
			total: EMPTY
		};
		let state: PossiblyEmpty<NoteState> = EMPTY;
		let updatedAt: PossiblyEmpty<Date | null> = EMPTY;

		displayNameStream({}).subscribe((dn) => (displayName = dn));
		stateStream({}).subscribe((s) => (state = s));
		updatedAtStream({}).subscribe((ua) => {
			updatedAt = ua;
		});
		note
			.stream()
			.entries({})
			.subscribe((e) => (entries = e));

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
		await note.addVolumes({}, { isbn: "0123456789", quantity: 2 });
		await waitFor(() => {
			expect(entries.rows).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "test-warehouse",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				}
			]);
		});

		// Entries stream
		//
		// Reset the entries
		await note.removeTransactions({}, { isbn: "0123456789", warehouseId: "test-warehouse" });
		await waitFor(() => expect(entries.rows).toEqual([]));
		// Add 20 entries and check the results
		await note.addVolumes({}, ...fiftyEntries.slice(0, 20));
		await waitFor(() => {
			expect(entries.rows).toEqual(
				fiftyEntries
					.slice(0, 20)
					.map((e) => ({
						__kind: "book",
						...e,
						warehouseId: "test-warehouse",
						warehouseName: "New Warehouse",
						warehouseDiscount: 0
					}))
					// Reversed as transactions are stored in a reverse order with respect to being added/aggregated
					.reverse()
			);
			expect(entries.total).toEqual(20);
		});

		// Updating a particular transaction (if belonging to the current page) should be streamed to the client.
		const matchTxn = fiftyEntries[19];
		const updateTxn = { ...matchTxn, quantity: 100, warehouseId: "test-warehouse" };
		await note.updateTransaction({}, matchTxn, updateTxn);
		await waitFor(() =>
			expect(entries.rows).toEqual([
				{ ...updateTxn, __kind: "book", warehouseName: "New Warehouse", warehouseDiscount: 0 },
				...fiftyEntries
					.slice(0, 19)
					.map((e) => ({
						...e,
						__kind: "book",
						warehouseId: "test-warehouse",
						warehouseName: "New Warehouse",
						warehouseDiscount: 0
					}))
					.reverse()
			])
		);

		// Warehouse discount update should be reflected in the note entries stream
		await db.warehouse("test-warehouse").setDiscount({}, 10);
		await waitFor(() =>
			expect(entries.rows).toEqual([
				{ ...updateTxn, __kind: "book", warehouseName: "New Warehouse", warehouseDiscount: 10 },
				...fiftyEntries
					.slice(0, 19)
					.map((e) => ({
						...e,
						__kind: "book",
						warehouseId: "test-warehouse",
						warehouseName: "New Warehouse",
						warehouseDiscount: 10
					}))
					.reverse()
			])
		);

		// Check for state stream
		expect(state).toEqual(NoteState.Draft);
		await note.commit();
		await waitFor(() => {
			expect(state).toEqual(NoteState.Committed);
		});
		// Check for updatedAt stream
		const ts1 = note.updatedAt;
		// Perform any update
		const { updatedAt: ts2 } = await note.addVolumes({}, { isbn: "0123456789", quantity: 2 });
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

		let entries: PossiblyEmpty<(VolumeStock<"custom"> | VolumeStockClientOld)[]> = EMPTY;
		note
			.stream()
			.entries({})
			.subscribe(({ rows }) => (entries = rows.map(volumeStockClientToVolumeStockClientOld)));

		// No transactions are added
		await waitFor(() => expect(entries).toEqual([]));

		// Add a tranasction with isbn not available in any warehouse
		await note.addVolumes({}, { isbn: "1234567890", quantity: 1 });

		// Should display the transaction, but no 'availableWarehouses'
		await waitFor(() =>
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [],
					warehouseDiscount: 0
				}
			])
		);

		// Add a book to the first warehouse
		await wh1
			.note()
			.create()
			.then((n) => n.addVolumes({}, { isbn: "1234567890", quantity: 2 }))
			.then((n) => n.commit());

		// 'availableWarehouses' (in outbound note transaction) should display the first warehouse
		await waitFor(() =>
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [{ id: "wh-1", displayName: "Warehouse 1" }],
					warehouseDiscount: 0
				}
			])
		);

		// Add the same book to the second warehouse
		await wh2
			.note()
			.create()
			.then((n) => n.addVolumes({}, { isbn: "1234567890", quantity: 2 }))
			.then((n) => n.commit());

		// 'availableWarehouses' (in outbound note transaction) should now display both warehouses
		await waitFor(() =>
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [
						{ id: "wh-1", displayName: "Warehouse 1" },
						{ id: "wh-2", displayName: "Warehouse 2" }
					],
					warehouseDiscount: 0
				}
			])
		);

		// Add a different book to the first warehouse
		await wh1
			.note()
			.create()
			.then((n) => n.addVolumes({}, { isbn: "1111111111", quantity: 2 }))
			.then((n) => n.commit());

		// Adding the same book to the outbound note should display only the first warehouse
		await note.addVolumes({}, { isbn: "1111111111", quantity: 1 });
		await waitFor(() =>
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "1111111111",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [{ id: "wh-1", displayName: "Warehouse 1" }],
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "",
					warehouseName: "not-found",
					availableWarehouses: [
						{ id: "wh-1", displayName: "Warehouse 1" },
						{ id: "wh-2", displayName: "Warehouse 2" }
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
		await note.setDefaultWarehouse({}, "wh-2");

		let entries: PossiblyEmpty<(VolumeStock<"custom"> | VolumeStockClientOld)[]> = EMPTY;
		note
			.stream()
			.entries({})
			.subscribe(({ rows }) => (entries = rows.map(volumeStockClientToVolumeStockClientOld)));

		// No transactions are added
		await waitFor(() => expect(entries).toEqual([]));

		// Add a tranasction
		await note.addVolumes({}, { isbn: "1234567890", quantity: 1 });

		// Should display the transaction with the default warehouse as warehouseId
		await waitFor(() =>
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "wh-2",
					warehouseName: "Warehouse 2",
					availableWarehouses: [],
					warehouseDiscount: 0
				}
			])
		);

		await note.setDefaultWarehouse({}, "wh-1");

		await note.addVolumes({}, { __kind: "book", isbn: "1234567890", quantity: 1 }, { __kind: "book", isbn: "1234567770", quantity: 1 });

		// Should display the second transaction with the default warehouse as warehouseId
		// and the first interaction should keep its default warehouseId
		await waitFor(() =>
			expect(entries).toEqual([
				{
					__kind: "book",
					isbn: "1234567770",
					quantity: 1,
					warehouseId: "wh-1",
					warehouseName: "Warehouse 1",
					availableWarehouses: [],
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "wh-1",
					warehouseName: "Warehouse 1",
					availableWarehouses: [],
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "1234567890",
					quantity: 1,
					warehouseId: "wh-2",
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
		await note1.addVolumes({}, { isbn: "0123456789", quantity: 3 });
		await note1.commit();

		await waitFor(() =>
			expect(warehouse1Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 3,
					warehouseId: "warehouse-1",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				}
			])
		);
		await waitFor(() =>
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 3,
					warehouseId: "warehouse-1",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				}
			])
		);
		await waitFor(() => expect(warehouse2Stock).toEqual([]));

		// Adding books to warehouse 2 should display changes in warehouse 2 and aggregate the stock of both warehouses in the default warehouse stock stream
		const note2 = warehouse2.note();
		await note2.addVolumes({}, { isbn: "0123456789", quantity: 3 });
		await note2.commit();

		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 3,
					warehouseId: "warehouse-1",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				}
			]);
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 3,
					warehouseId: "warehouse-1",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 3,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
			expect(warehouse2Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 3,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Non committed notes should not be taken into account (when calculating the stock)
		const note3 = warehouse1.note();
		await note3.addVolumes({}, { isbn: "0123456789", quantity: 3 });
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 3,
					warehouseId: "warehouse-1",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				}
			]);
			// If the assertion for warehouse-1 (in this case) passes, the other two streams are implicitly not affected
			// (according to the previous two assertions)
		});

		// Outbound notes should decrement the stock (of both the particular warehouse, as well as the default warehouse)
		const note4 = defaultWarehouse.note();
		await note4.addVolumes(
			{},
			{ isbn: "0123456789", quantity: 2, warehouseId: "warehouse-1" },
			{ isbn: "0123456789", quantity: 1, warehouseId: "warehouse-2" }
		);

		await note4.commit();
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				}
			]);
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "New Warehouse",
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
			expect(warehouse2Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Updating a warehouse name should be reflected in the stock stream
		await warehouse1.setName({}, "Warehouse 1");
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "Warehouse 1",
					warehouseDiscount: 0
				}
			]);
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "Warehouse 1",
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Updating a warehouse discount should be reflected in the stock stream
		await warehouse1.setDiscount({}, 20);
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "Warehouse 1",
					warehouseDiscount: 20
				}
			]);
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "Warehouse 1",
					warehouseDiscount: 20
				},
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Zero quantity should remove the entry from the stock stream
		const note5 = defaultWarehouse.note();
		await note5.addVolumes({}, { isbn: "0123456789", quantity: 1, warehouseId: "warehouse-1" });
		await note5.commit();
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([]);
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});

		// Note transactions with zero quantity should not affect the stock
		const note6 = warehouse1.note();
		await note6.addVolumes(
			{},
			{ isbn: "0123456789", quantity: 0, warehouseId: "warehouse-1" },
			// Other transaction is here to:
			// - check that it is taken into account (only 0-quantity transactions are ignored, not the entire note)
			// - to confirm an update has happened (as testing for something not being applied will pass immeditealy, due to async nature)
			{ isbn: "11111111", quantity: 1, warehouseId: "warehouse-1" }
		);
		await note6.commit();
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "Warehouse 1",
					warehouseDiscount: 20
				}
			]);
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					isbn: "11111111",
					quantity: 1,
					warehouseId: "warehouse-1",
					warehouseName: "Warehouse 1",
					warehouseDiscount: 20
				}
			]);
		});

		// Custom items should not affect the stock
		const note7 = defaultWarehouse.note();
		await note7.addVolumes(
			{},
			{ __kind: "custom", id: "custom-item-1", title: "Custom Item", price: 10 },
			// Removing one book from stock, the regular way, to assert that the update did happen (and custom item just wasn't taken into account)
			{ isbn: "11111111", quantity: 1, warehouseId: "warehouse-1" }
		);
		await note7.commit();
		await waitFor(() => {
			expect(warehouse1Stock).toEqual([]);
			expect(defaultWarehouseStock).toEqual([
				{
					__kind: "book",
					isbn: "0123456789",
					quantity: 2,
					warehouseId: "warehouse-2",
					warehouseName: "New Warehouse (2)",
					warehouseDiscount: 0
				}
			]);
		});
	});

	test("warehouseDataMapStream", async () => {
		const wl$ = db.stream().warehouseMap({});
		let warehouseDataMap: PossiblyEmpty<Array<Pick<WarehouseData, "displayName" | "discountPercentage"> & { id: string }>> = EMPTY;
		wl$.subscribe(
			(wm) => (warehouseDataMap = [...wm].map(([id, { displayName, discountPercentage }]) => ({ id, displayName, discountPercentage })))
		);

		// The default warehouse should be created automatically
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([{ id: "all", displayName: "All", discountPercentage: 0 }]);
		});
		const warehouse = await db.warehouse("new-warehouse").create();
		await waitFor(() => {
			// The default ("all") warehouse should be created as well (when the first warehouse is created)
			expect(warehouseDataMap).toEqual([
				{ id: "all", displayName: "All", discountPercentage: 0 },
				{ id: "new-warehouse", displayName: "New Warehouse", discountPercentage: 0 }
			]);
		});

		// Updating a warehouse name, should be reflected in warehouseList stream as well
		await warehouse.setName({}, "New Name");
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([
				{ id: "all", displayName: "All", discountPercentage: 0 },
				{ id: "new-warehouse", displayName: "New Name", discountPercentage: 0 }
			]);
		});

		// Updating a warehouse discount, should be reflected in warehouseList stream as well
		await warehouse.setDiscount({}, 10);
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([
				{ id: "all", displayName: "All", discountPercentage: 0 },
				{ id: "new-warehouse", displayName: "New Name", discountPercentage: 10 }
			]);
		});

		// Adding a note (for instance) shouldn't affect the warehouse list
		await warehouse.note().create();
		await waitFor(() => {
			expect(warehouseDataMap).toEqual([
				{ id: "all", displayName: "All", discountPercentage: 0 },
				{ id: "new-warehouse", displayName: "New Name", discountPercentage: 10 }
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
					{ id: "all", displayName: "All", notes: [] },
					{ id: "warehouse-1", displayName: "New Warehouse", notes: [] }
				]);
			});

			// When a new inbound note is created, it should be added to the list (for both the particular warehouse, as well as the default warehouse)
			const note1 = await warehouse1.note().create();
			await waitFor(() => {
				expect(inNoteList).toEqual([
					{ id: "all", displayName: "All", notes: [{ id: note1.id, displayName: "New Note" }] },
					{
						id: "warehouse-1",
						displayName: "New Warehouse",
						notes: [{ id: note1.id, displayName: "New Note" }]
					}
				]);
			});

			// Updating of the note name should be reflected in the stream
			await note1.setName({}, "New Name");
			await waitFor(() => {
				expect(inNoteList).toEqual([
					{ id: "all", displayName: "All", notes: [{ id: note1.id, displayName: "New Name" }] },
					{
						id: "warehouse-1",
						displayName: "New Warehouse",
						notes: [{ id: note1.id, displayName: "New Name" }]
					}
				]);
			});

			// Adding a note in another warehouse should add it to a particular warehouse, as well as the default warehouse
			const note2 = await db.warehouse("warehouse-2").note().create();
			await waitFor(() => {
				expect(inNoteList).toEqual([
					{
						id: "all",
						displayName: "All",
						notes: [
							{ id: note1.id, displayName: "New Name" },
							{ id: note2.id, displayName: "New Note" }
						]
					},
					{
						id: "warehouse-1",
						displayName: "New Warehouse",
						notes: [{ id: note1.id, displayName: "New Name" }]
					},
					{
						id: "warehouse-2",
						displayName: "New Warehouse (2)",
						notes: [{ id: note2.id, displayName: "New Note" }]
					}
				]);
			});

			// Deleting a note should remove it from the list (but the warehouse should still be there)
			await note2.delete({});
			await waitFor(() => {
				expect(inNoteList).toEqual([
					{ id: "all", displayName: "All", notes: [{ id: note1.id, displayName: "New Name" }] },
					{
						id: "warehouse-1",
						displayName: "New Warehouse",
						notes: [{ id: note1.id, displayName: "New Name" }]
					},
					{ id: "warehouse-2", displayName: "New Warehouse (2)", notes: [] }
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
						id: "all",
						displayName: "All",
						notes: [{ id: note1.id, displayName: "New Note - Updated" }]
					},
					{
						id: "warehouse-1",
						displayName: "New Warehouse",
						notes: [{ id: note1.id, displayName: "New Note - Updated" }]
					},
					{ id: "warehouse-2", displayName: "New Warehouse (2)", notes: [] }
				]);
			});

			// Should not stream committed notes
			const note3 = await warehouse1.note().create();
			await waitFor(() => {
				expect(inNoteList).toEqual([
					{
						id: "all",
						displayName: "All",
						notes: [
							{ id: note1.id, displayName: "New Note - Updated" },
							{
								id: note3.id,
								// There's already an outbound note with the name "New Note"
								displayName: "New Note (2)"
							}
						]
					},
					{
						id: "warehouse-1",
						displayName: "New Warehouse",
						notes: [
							{ id: note1.id, displayName: "New Note - Updated" },
							{ id: note3.id, displayName: "New Note (2)" }
						]
					},
					{ id: "warehouse-2", displayName: "New Warehouse (2)", notes: [] }
				]);
			});

			await note3.commit({}, { force: true });
			await waitFor(() => {
				expect(inNoteList).toEqual([
					{
						id: "all",
						displayName: "All",
						notes: [{ id: note1.id, displayName: "New Note - Updated" }]
					},
					{
						id: "warehouse-1",
						displayName: "New Warehouse",
						notes: [{ id: note1.id, displayName: "New Note - Updated" }]
					},
					{ id: "warehouse-2", displayName: "New Warehouse (2)", notes: [] }
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
			expect(outNoteList).toEqual([{ id: note1.id, displayName: "New Note" }]);
		});

		// Add another note
		const note2 = await db.warehouse().note().create();
		await waitFor(() => {
			expect(outNoteList).toEqual([
				{ id: note1.id, displayName: "New Note" },
				{ id: note2.id, displayName: "New Note (2)" }
			]);
		});

		// Deleting the note should be reflected in the stream
		await note2.delete({});
		await waitFor(() => {
			expect(outNoteList).toEqual([{ id: note1.id, displayName: "New Note" }]);
		});

		// Change of note display name should be reflected in the stream
		await note1.setName({}, "New Name");
		await waitFor(() => {
			expect(outNoteList).toEqual([{ id: note1.id, displayName: "New Name" }]);
		});

		// Inbound notes should not be included in the list
		await db.warehouse("warehouse-1").note().create();
		// Testing the async update which shouldn't happen is a bit tricky, so we're applying additional update
		// which, most certainly should happen, but would happen after the not-wanted update, so we can assert that
		// only the latter took place.
		await note1.setName({}, "New Note - Updated");
		await waitFor(() => {
			expect(outNoteList).toEqual([{ id: note1.id, displayName: "New Note - Updated" }]);
		});

		// Should not stream committed notes
		const note3 = await db.warehouse().note().create();
		await waitFor(() => {
			expect(outNoteList).toEqual([
				{ id: note1.id, displayName: "New Note - Updated" },
				// There's already an inbound note with the name "New Note"
				{ id: note3.id, displayName: "New Note (2)" }
			]);
		});

		await note3.commit({}, { force: true });
		await waitFor(() => {
			expect(outNoteList).toEqual([{ id: note1.id, displayName: "New Note - Updated" }]);
		});
	});

	test("past transactions stream", async () => {
		let pastTransactions: PossiblyEmpty<PastTransactionsMap> = EMPTY;
		db.history()
			.stream({})
			.subscribe(($pt) => (pastTransactions = $pt.by("date")));

		// Initial stream should be an empty map
		await waitFor(() => expect(pastTransactions).toEqual(new Map()));

		const date = new Date();
		const slicedDate = date.toISOString().slice(0, 10);

		const warehouse1 = db.warehouse("warehouse-1");
		const warehouse2 = db.warehouse("warehouse-2");

		const note1 = await warehouse1.note().create();
		const note2 = await warehouse2.note().create();

		await note1.addVolumes({}, { isbn: "11111111", quantity: 2 }, { isbn: "22222222", quantity: 2 }).then((n) => n.commit());
		await note2.addVolumes({}, { isbn: "11111111", quantity: 2 }, { isbn: "22222222", quantity: 2 }).then((n) => n.commit());

		let transactions = [
			{
				isbn: "11111111",
				quantity: 2,
				warehouseId: warehouse1.id,
				date: expect.stringContaining(slicedDate),
				noteType: "inbound",
				noteId: note1.id,
				noteDisplayName: note1.displayName
			},
			{
				isbn: "22222222",
				quantity: 2,
				date: expect.stringContaining(slicedDate),
				noteType: "inbound",
				warehouseId: warehouse1.id,
				noteId: note1.id,
				noteDisplayName: note1.displayName
			},
			{
				isbn: "11111111",
				quantity: 2,
				date: expect.stringContaining(slicedDate),
				noteType: "inbound",
				warehouseId: warehouse2.id,
				noteId: note2.id,
				noteDisplayName: note2.displayName
			},
			{
				isbn: "22222222",
				quantity: 2,
				date: expect.stringContaining(slicedDate),
				noteType: "inbound",
				warehouseId: warehouse2.id,
				noteId: note2.id,
				noteDisplayName: note2.displayName
			}
		];

		await waitFor(() => {
			expect(pastTransactions).toEqual(new Map([[slicedDate, transactions]]));
		});

		// add some outbound notes
		const note3 = await db.warehouse().note().create();
		await note3.addVolumes(
			{},
			{ isbn: "11111111", quantity: 1, warehouseId: warehouse1.id },
			{ isbn: "22222222", quantity: 1, warehouseId: warehouse2.id }
		);
		note3.commit();

		transactions = [
			...transactions,
			{
				isbn: "11111111",
				quantity: 1,
				noteType: "outbound",
				date: expect.stringContaining(slicedDate),
				warehouseId: warehouse1.id,
				noteId: note3.id,
				noteDisplayName: note3.displayName
			},
			{
				isbn: "22222222",
				quantity: 1,
				noteType: "outbound",
				date: expect.stringContaining(slicedDate),
				warehouseId: warehouse2.id,
				noteId: note3.id,
				noteDisplayName: note3.displayName
			}
		];

		await waitFor(() => {
			expect(pastTransactions).toEqual(new Map([[slicedDate, transactions]]));
		});
	});

	test("warehouse naming sequence", async () => {
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

	test("note naming sequence", async () => {
		const defaultWarehouse = await db.warehouse().create();

		const note1 = await defaultWarehouse.note().create(); // New Note

		const note2 = await defaultWarehouse.note().create(); // New Note (2)

		const note3 = await defaultWarehouse.note().create(); // New Note (3)
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

	test("streams should fall back to default value for their type", async () => {
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
			id: "all",
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
		await booksInterface.upsert({}, [book1, book2]);

		const booksFromDb = await booksInterface.get({}, [book1.isbn, book2.isbn]);

		// There's a full book data in each entry, the operation should assign 'updatedAt'
		expect(booksFromDb).toEqual([book1, book2].map((b) => ({ ...b, updatedAt: expect.any(String) })));
		const updatedAt = booksFromDb[0]!.updatedAt;

		// Update test
		await Promise.all([
			booksInterface.upsert({}, [
				{ ...book1, title: "Updated Title" },
				{ ...book2, title: "Updated Title 12" }
			])
		]);

		const updatedBooksFromDb = await booksInterface.get({}, [book1.isbn, book2.isbn]);

		expect(updatedBooksFromDb).toEqual([
			{ ...book1, title: "Updated Title", updatedAt: expect.any(String) },
			{ ...book2, title: "Updated Title 12", updatedAt: expect.any(String) }
		]);
		// The 'updatedAt' should be updated
		expect(updatedBooksFromDb[0]!.updatedAt).not.toEqual(updatedAt);

		// ISBN-only entries should not get the 'updatedAt' assigned to them
		await db.books().upsert({}, [{ isbn: "1111111111" }]);
		await db.books().upsert({}, [{ isbn: "1111111111" }]); // One more (update) for good measure
		expect(await db.books().get({}, ["1111111111"])).toEqual([{ isbn: "1111111111" }]);

		// Adding at least one additiona field should assign the 'updatedAt'
		await db.books().upsert({}, [{ isbn: "1111111111", title: "Title 1" }]); // One more (update) for good measure
		expect(await db.books().get({}, ["1111111111"])).toEqual([{ isbn: "1111111111", title: "Title 1", updatedAt: expect.any(String) }]);

		// Stream test
		let bookEntries: (BookEntry | undefined)[] = [];

		booksInterface.stream({}, [book1.isbn, book2.isbn, book3.isbn]).subscribe((stream) => {
			bookEntries = stream;
		});

		await waitFor(() => {
			expect(bookEntries).toEqual([
				{ ...book1, title: "Updated Title", updatedAt: expect.any(String) },
				{ ...book2, title: "Updated Title 12", updatedAt: expect.any(String) },
				undefined
			]);
		});

		// Stream should update when the book in the db is updated
		await db.books().upsert({}, [{ ...book1, title: "Stream updated title" }]);

		await waitFor(() => {
			expect(bookEntries).toEqual([
				{ ...book1, title: "Stream updated title", updatedAt: expect.any(String) },
				{ ...book2, title: "Updated Title 12", updatedAt: expect.any(String) },
				undefined
			]);
		});

		// Stream should update if the book we're requesting (which didn't exist) is added
		await db.books().upsert({}, [book3]);

		await waitFor(() => {
			expect(bookEntries).toEqual([
				{ ...book1, title: "Stream updated title", updatedAt: expect.any(String) },
				{ ...book2, title: "Updated Title 12", updatedAt: expect.any(String) },
				{ ...book3, updatedAt: expect.any(String) }
			]);
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
		await db.books().upsert({}, [{ isbn: "new-isbn", publisher: "HarperCollins UK" } as BookEntry]);
		await waitFor(() => expect(publishers).toEqual(["HarperCollins UK"]));

		await db.books().upsert({}, [
			{ isbn: "new-isbn-2", publisher: "Oxford" },
			{ isbn: "new-isbn-3", publisher: "Penguin" }
		] as BookEntry[]);
		await waitFor(() => expect(publishers).toEqual(["HarperCollins UK", "Oxford", "Penguin"]));

		// Adding a book with existing publisher should not duplicate the publisher in the stream
		await db.books().upsert({}, [{ isbn: "new-isbn-4", publisher: "Oxford" } as BookEntry]);
		await waitFor(() => expect(publishers).toEqual(["HarperCollins UK", "Oxford", "Penguin"]));
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
				.addVolumes({}, { isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" })
				.then((n) => n.commit()),
			wh2
				.note()
				.addVolumes({}, { isbn: "22222222", quantity: 2, warehouseId: "warehouse-2" })
				.then((n) => n.commit())
		]);

		// Create an outbound note with invalid transactions
		const note = await db.warehouse().note().addVolumes(
			{},
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
		await expect(note.commit()).rejects.toThrow(new NoWarehouseSelectedError([{ isbn: "22222222", quantity: 2, warehouseId: "" }]));

		// Fix warehouse selection
		await note.updateTransaction({}, { isbn: "22222222" }, { isbn: "22222222", quantity: 2, warehouseId: "warehouse-1" });
		// Current note transactions:
		// - "11111111": 2 (warehouse-1) - valid
		// - "22222222": 2 (warehouse-1) - invlid - no "22222222" in warehouse-1 stock
		// - "22222222": 3 (warehouse-2) - invalid - not enough stock in warehouse-2
		// - "11111111": 1 (warehouse-2) - invalid - no "11111111" in warehouse-2 stock

		// Can't commit the note as it contains out-of-stock transactions
		await expect(note.commit()).rejects.toThrow(
			new OutOfStockError([
				{ isbn: "11111111", warehouseId: "warehouse-2", warehouseName: "Warehouse 2", quantity: 1, available: 0 },
				{ isbn: "22222222", warehouseId: "warehouse-1", warehouseName: "Warehouse 1", quantity: 2, available: 0 },
				{ isbn: "22222222", warehouseId: "warehouse-2", warehouseName: "Warehouse 2", quantity: 3, available: 2 }
			])
		);

		// Fix the note - remove excess quantity/transactions
		await note.removeTransactions({}, { isbn: "22222222", warehouseId: "warehouse-1" }, { isbn: "11111111", warehouseId: "warehouse-2" });
		await note.updateTransaction(
			{},
			{ isbn: "22222222", warehouseId: "warehouse-2" },
			{ isbn: "22222222", quantity: 2, warehouseId: "warehouse-2" }
		);
		// Current note transactions:
		// - "11111111": 2 (warehouse-1) - valid
		// - "22222222": 2 (warehouse-2) - valid

		await note.commit();
		await waitFor(() => note.get().then((n) => expect(n!.committed).toEqual(true)));

		// Committing a note with custom item only should be allowed
		await db
			.warehouse()
			.note()
			.create()
			.then((n) => n.addVolumes({}, { __kind: "custom", id: "custom-item-1", title: "Custom Item", price: 10 }))
			.then((n) => n.commit());
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
					{},
					{ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" },
					{ isbn: "22222222", quantity: 3, warehouseId: "warehouse-1" }
				)
				.then((n) => n.commit()),
			warehouse2
				.note()
				.addVolumes({}, { isbn: "11111111", quantity: 1, warehouseId: "warehouse-2" })
				.then((n) => n.commit()),
			warehouse3
				.note()
				.addVolumes({}, { isbn: "11111111", quantity: 1, warehouseId: "warehouse-3" })
				.then((n) => n.commit())
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
			{},
			// In-stock - all fine
			{ isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" },
			// In-stock - one should remain after the note is committed
			{ isbn: "22222222", quantity: 2, warehouseId: "warehouse-1" },
			// Not-in-stock - reconciliation should add 2, resulting in 0 after the note is committed
			{ isbn: "33333333", quantity: 2, warehouseId: "warehouse-1" },
			// Not-fully-in-stock - reconciliation should add 2, resulting in 0 after the note is committed
			{ isbn: "11111111", quantity: 3, warehouseId: "warehouse-2" },
			// Not-in-stock - reconciliation should add 1, resulting in 0 after the note is committed
			{ isbn: "22222222", quantity: 1, warehouseId: "warehouse-3" },
			// Adding custom item as noise - shouldn't affect these checks
			{ __kind: "custom", id: "custom-item-1", title: "Custom Item", price: 10 }
		);

		// We can't commit the note yet
		try {
			await note.commit();
		} catch (err) {
			expect(err instanceof OutOfStockError).toEqual(true);
		}

		// Reconcile and commit the note
		await note.reconcile({});
		// We should be able to commit the note now
		await note.commit();

		// Check remaining stock (all warehouses)
		const stock = await db.warehouse().getEntries({});
		expect([...stock]).toEqual([
			// Stock is missing only the books that were there to begin with (and reduced by the outbond note)
			expect.objectContaining({ isbn: "22222222", quantity: 1, warehouseId: "warehouse-1" }),
			expect.objectContaining({ isbn: "11111111", quantity: 1, warehouseId: "warehouse-3" })
		]);
	});

	// TODO: this should be unnecessary if we simplify the interfaces to split interfaces (behaviour) and data (retrieved or streamed)
	test("sync note and warehouse interface with the db", async () => {
		// Create a displayName "store" for the note
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
		await noteInst2.addVolumes({}, { isbn: "11111111", quantity: 2, warehouseId: "warehouse-1" });

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
		expect(await db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true }).all()).toEqual([undefined]);

		// Registering a plugin implementation should use that implementation for all subsequent calls to 'fetchBookData'
		//
		// The impl1 will return the 'isbn' and the 'title' (same as isbn)
		const impl1 = createSingleSourceBookFetcher("impl-1", async (isbn) => ({ isbn, title: isbn }), true);

		// Calling the implementation returned after registering the plugin
		db.plugin("book-fetcher").register(impl1);
		expect(await db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true }).first()).toEqual({
			isbn: "11111111",
			title: "11111111"
		});
		expect(await db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true }).all()).toEqual([
			{ isbn: "11111111", title: "11111111" }
		]);

		// Registering a different implementation should make the book fetching return results from all sources
		//
		// The impl2 will return only the price (static 20) - the results should be merged
		const impl2 = createSingleSourceBookFetcher("impl-2", async () => ({ price: 20 }), true);

		db.plugin("book-fetcher").register(impl2);
		// We're not testing for '.first()' here as the order of the results (in case of '.first()') is not guaranteed
		//
		// The order of results for '.all()' should be the same as the order of plugins registration
		expect(await db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true }).all()).toEqual([
			// Result from impl1
			{ isbn: "11111111", title: "11111111" },
			// Result from impl2
			{ price: 20 }
		]);

		// Stream should stream the results as they resolve (in an arbitrary order)
		const streamRes = await firstValueFrom(
			db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true }).stream().pipe(toArray())
		);
		expect(streamRes.length).toEqual(2);
		expect(streamRes).toEqual(expect.arrayContaining([{ isbn: "11111111", title: "11111111" }, { price: 20 }]));

		// Reset the plugins to test the caching
		db.plugin("book-fetcher").reset();
		// Verify the reset was successful
		expect(await db.plugin("book-fetcher").fetchBookData("11111111").all()).toEqual([undefined]);

		// Attempting to fetch the same isbn that was already tried should return the cached result
		//
		// Set the new plugin implementation
		const impl3 = createSingleSourceBookFetcher(
			"impl-3",
			(isbn) => new Promise((res) => setTimeout(() => res({ isbn, title: new Date().toISOString() }), 200)),
			true
		);
		db.plugin("book-fetcher").register(impl3);

		// Attempting to fetch witout the retry flag should return the cached result
		expect(await db.plugin("book-fetcher").fetchBookData("11111111").all()).toEqual([undefined]);

		// Fetching with the retry flag gives the new result
		expect(await db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true }).all()).toEqual([
			{ isbn: "11111111", title: expect.any(String) }
		]);

		// If attempting to fetch two isbns at the same time, we should get the first result for all fetch operations
		//
		// Note: we're not awaiting the results before initialising the second fetch operation
		const res1 = db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true });
		// The timeout for the mock fetch operation is 200ms - we can wait for 100ms before initialising the second fetch and be cofident
		// that the first won't resolve before the second fetch is initialised
		await new Promise((res) => setTimeout(res, 100));
		const res2 = db.plugin("book-fetcher").fetchBookData("11111111", { retryIfAlreadyAttempted: true });

		const res1Val = await res1.first();
		const res2Val = await res2.first();

		// The timestamped titles shold be exqual
		expect(res1Val!.title).toEqual(res2Val!.title);
	});

	test("receipt generation", async () => {
		// We're creating a bunch of transactions to test the receipt
		// taking into account entries which would be omitted in the UI by pagination.
		const transactions = Array(20)
			.fill(null)
			.map((_, i) => ({
				isbn: `transaction-${`0${i}`.slice(-2)}`,
				title: `Transaction ${i}`,
				quantity: 2,
				warehouseId: "wh-1",
				price: (1 + i) * 2
			}));

		(db as any)._db.replicated((db) => db.selectFrom("customItemTransactions").selectAll()).subscribe(console.log);

		// Setup: Create a note and book data for transactions
		const [note] = await Promise.all([
			db
				.warehouse()
				.note()
				.create()
				// Add all transactions to the note
				.then((n) => n.addVolumes({}, ...transactions.map(({ isbn, quantity, warehouseId }) => ({ isbn, quantity, warehouseId })))),
			// Create book data entries for transactions
			db.books().upsert(
				{},
				transactions.map(({ isbn, title, price }) => ({ isbn, title, price }))
			)
		]);

		// Get the receipt items from the note

		// The print job should have been added to the print queue
		let receipt = await note.intoReceipt();
		expect(receipt).toEqual({
			timestamp: expect.any(Number),
			items: transactions.map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price, discount: 0 }))
		});

		// Add a discount to wh-1
		await db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setDiscount({}, 50));

		// Print the note again
		receipt = await note.intoReceipt();

		// The print job should have been added to the print queue with discounted prices

		expect(receipt).toEqual({
			timestamp: expect.any(Number),
			items: transactions.map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price, discount: 50 }))
		});

		// Add transactions belonging to different warehouse (no discount should be applied to those)
		//
		// Transactions are the first two from the previous array (they already have a price set with book data), but since
		// they belong to wh-2, no discount will be applied
		await note.addVolumes({}, ...transactions.slice(0, 2).map((txn) => ({ ...txn, warehouseId: "wh-2" })));

		// The print job should have been added to the print queue with discounted prices
		receipt = await note.intoReceipt();
		expect(receipt).toEqual({
			timestamp: expect.any(Number),
			items: [
				// wh-1 transactions - with discount applied
				...transactions.map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price, discount: 50 })),
				// additional two transactions (wh-2) - no discount applied
				...transactions.slice(0, 2).map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price, discount: 0 }))
			]
		});

		// Add custom items - they should also end up in the receipt (each with quantity 1 and discount 0)
		await note.addVolumes({}, { __kind: "custom", title: "Item 1", price: 20 }, { __kind: "custom", title: "Item 2", price: 35 });

		// The print job should have been added to the print queue with discounted prices
		receipt = await note.intoReceipt();
		expect(receipt).toEqual({
			timestamp: expect.any(Number),
			items: [
				// wh-1 transactions - with discount applied
				...transactions.map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price, discount: 50 })),
				// additional two transactions (wh-2) - no discount applied
				...transactions.slice(0, 2).map(({ isbn, title, quantity, price }) => ({ isbn, title, quantity, price, discount: 0 })),
				// custom items
				{ __kind: "custom", id: expect.any(String), title: "Item 1", price: 20, quantity: 1, discount: 0 },
				{ __kind: "custom", id: expect.any(String), title: "Item 2", price: 35, quantity: 1, discount: 0 }
			]
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
		await db.books().upsert({}, books);

		let index: SearchIndex = new Search([]);
		db.books()
			.streamSearchIndex()
			.subscribe((i) => (index = i));

		// Search string: "oxford" - should match "Oxford University Press" (regardless of letter casing)
		await waitFor(() => expect(index.search("oxford")).toEqual([pets, time].map((b) => ({ ...b, updatedAt: expect.any(String) }))));

		// Search string: "stephen" - should match "Stephen King" (author) and "Stephen Hawking" (author)
		// expect(index.search("stephen")).toEqual([pets, time]);

		// Search string: "king" - should match both "(...) Return of The King" (title) and "Stephen King" (author)
		await waitFor(() => expect(index.search("king")).toEqual([lotr, pets].map((b) => ({ ...b, updatedAt: expect.any(String) }))));

		// Adding a book to the db should update the index
		const werther = {
			isbn: "44444444",
			title: "The Sorrows of Young Werther",
			authors: "Johann Wolfgang von Goethe",
			publisher: "Penguin Classics",
			price: 40
		};
		await db.books().upsert({}, [werther]);
		await waitFor(() =>
			expect(index.search("Penguin Classics")).toEqual([lotr, werther].map((b) => ({ ...b, updatedAt: expect.any(String) })))
		);
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

const volumeStockClientToVolumeStockClientOld = (entry: VolumeStockClient): VolumeStock<"custom"> | VolumeStockClientOld => {
	if (entry.__kind === "custom") {
		return entry;
	}
	const { availableWarehouses, ...vsc } = entry;
	return {
		...vsc,
		...(availableWarehouses ? { availableWarehouses: navMapToNavList(availableWarehouses) } : {})
	};
};
// #endregion
