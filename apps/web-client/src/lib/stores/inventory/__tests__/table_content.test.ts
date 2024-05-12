import { describe, test, expect } from "vitest";
import { readable } from "svelte/store";

import { testUtils } from "@librocco/shared";

import type { VolumeQuantity } from "$lib/types/db";
import type { DisplayRow } from "$lib/types/inventory";

import { createDisplayEntriesStore } from "../table_content";
import { newTestDB } from "$lib/__testUtils__/db";

const { waitFor } = testUtils;

describe("tableContentStore", () => {
	test("should not explode if no 'entity' is provided", async () => {
		let displayEntries: VolumeQuantity[] | undefined;

		// Both db and entity are undefined (this will happen at build time, as db is instantiated only in browser)
		let tableData = createDisplayEntriesStore({}, undefined, undefined, readable(0));
		tableData.entries.subscribe((de) => (displayEntries = de as VolumeQuantity[]));
		expect(displayEntries).toEqual([]);

		// Reset the 'displayEntries'
		displayEntries = undefined;

		// Should also work if db is defined but entity is undefined (this might happen if the entity id is not specified)
		const db = await newTestDB();
		tableData = createDisplayEntriesStore({}, db, undefined, readable(0));
		tableData.entries.subscribe((de) => (displayEntries = de as VolumeQuantity[]));
		expect(displayEntries).toEqual([]);
	});

	test("should stream book data with the entires (matching their isbn)", async () => {
		const db = await newTestDB();

		const book1 = {
			isbn: "0194349276",
			title: "Holiday Jazz Chants",
			authors: "Carolyn Graham",
			publisher: "Oxford",
			year: "1999",
			price: 39.86
		};
		const book2 = {
			isbn: "0195399706",
			title: "The Age of Wonder",
			authors: "Richard Holmes",
			publisher: "HarperCollins UK",
			year: "2008",
			price: 69.99
		};
		const book3 = {
			isbn: "019976915X",
			title: "Twelve Bar Blues",
			authors: "Patrick Neate",
			publisher: "Penguin UK",
			year: "2002",
			price: 39.86
		};

		// Set up initial state:
		const note = await db.warehouse().note("note-1").create();
		await Promise.all([
			// Only the transaction for book1 is present
			note.addVolumes({ isbn: book1.isbn, quantity: 12, warehouseId: "jazz" }),
			// Both books are present in the db
			db.books().upsert([book1, book2])
		]);

		const tableData = createDisplayEntriesStore({}, db, note, readable(0));
		let displayEntries: DisplayRow[];
		tableData.entries.subscribe((de) => (displayEntries = de));

		// Should receive the initial state (only book1 transaction in the note)
		await waitFor(() =>
			expect(displayEntries).toEqual([
				{
					...book1,
					__kind: "book",
					quantity: 12,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				}
			])
		);

		// Update the note (add additional transactions)
		await note.addVolumes({ isbn: book2.isbn, quantity: 10, warehouseId: "jazz" }, { isbn: book3.isbn, quantity: 5, warehouseId: "jazz" });
		await waitFor(() => {
			expect(displayEntries).toEqual([
				{
					__kind: "book",
					...book1,
					quantity: 12,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				},
				// Book data for book2 is already available in the db
				{
					__kind: "book",
					...book2,
					quantity: 10,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				},
				// Book data for book3 is not available in the db - only the transaction data is shown
				{
					__kind: "book",
					isbn: book3.isbn,
					quantity: 5,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				}
			]);
		});

		// Update book data for book3
		await db.books().upsert([book3]);
		await waitFor(() => {
			expect(displayEntries).toEqual([
				{
					__kind: "book",
					...book1,
					quantity: 12,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					...book2,
					quantity: 10,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				},
				// Full book3 data should be displayed
				{
					__kind: "book",
					...book3,
					quantity: 5,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				}
			]);
		});

		// Update the first book data
		await db.books().upsert([{ ...book1, title: "The Age of Wonder (updated)" }]);
		// The update should be reflected in the resulting stream
		await waitFor(() => {
			expect(displayEntries).toEqual([
				{
					__kind: "book",
					...book1,
					title: "The Age of Wonder (updated)",
					quantity: 12,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					...book2,
					quantity: 10,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					...book3,
					quantity: 5,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				}
			]);
		});
	});

	test("should apply warehouse discount (if any)", async () => {
		const db = await newTestDB();

		const book1 = {
			isbn: "0194349276",
			title: "Holiday Jazz Chants",
			authors: "Carolyn Graham",
			publisher: "Oxford",
			year: "1999",
			price: 60
		};
		const book2 = {
			isbn: "0195399706",
			title: "The Age of Wonder",
			authors: "Richard Holmes",
			publisher: "HarperCollins UK",
			year: "2008",
			price: 12
		};

		// Set up initial state:
		const [wh1, wh2] = await Promise.all([
			db
				.warehouse("wh-1")
				.create()
				.then((w) => w.setName({}, "Warehouse 1")),
			db
				.warehouse("wh-2")
				.create()
				.then((w) => w.setName({}, "Warehouse 2"))
		]);
		const note = await db.warehouse().note("note-1").create();
		await Promise.all([
			note.addVolumes({ isbn: book1.isbn, quantity: 12, warehouseId: "wh-1" }, { isbn: book2.isbn, quantity: 10, warehouseId: "wh-2" }),
			// Both books are present in the db
			db.books().upsert([book1, book2])
		]);

		const tableData = createDisplayEntriesStore({}, db, note, readable(0));
		let displayEntries: DisplayRow[];
		tableData.entries.subscribe((de) => (displayEntries = de));

		// Displays the state (including prices) as is
		await waitFor(() =>
			expect(displayEntries).toEqual([
				{
					__kind: "book",
					...book1,
					quantity: 12,
					warehouseId: `v1/wh-1`,
					warehouseName: "Warehouse 1",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				},
				{
					__kind: "book",
					...book2,
					quantity: 10,
					warehouseId: `v1/wh-2`,
					warehouseName: "Warehouse 2",
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				}
			])
		);

		// Set the warehouse discount for the first warehouse
		await wh1.setDiscount({}, 10);
		await waitFor(() =>
			expect(displayEntries).toEqual([
				// The price of book1 should be discounted (as wh-1 has a discount of 10%)
				{
					__kind: "book",
					...book1,
					quantity: 12,
					warehouseId: `v1/wh-1`,
					warehouseName: "Warehouse 1",
					price: 54,
					availableWarehouses: new Map(),
					warehouseDiscount: 10
				},
				// Warehouse 2 doesn't have a discount applied to it
				{
					__kind: "book",
					...book2,
					quantity: 10,
					warehouseId: `v1/wh-2`,
					warehouseName: "Warehouse 2",
					price: 12,
					availableWarehouses: new Map(),
					warehouseDiscount: 0
				}
			])
		);

		// Set the warehouse discount for the second warehouse
		await wh2.setDiscount({}, 20);
		await waitFor(() =>
			expect(displayEntries).toEqual([
				// Applied discount: 10%
				{
					__kind: "book",
					...book1,
					quantity: 12,
					warehouseId: `v1/wh-1`,
					warehouseName: "Warehouse 1",
					price: 54,
					availableWarehouses: new Map(),
					warehouseDiscount: 10
				},
				// Applied discount: 20%
				{
					__kind: "book",
					...book2,
					quantity: 10,
					warehouseId: `v1/wh-2`,
					warehouseName: "Warehouse 2",
					price: 9.6,
					availableWarehouses: new Map(),
					warehouseDiscount: 20
				}
			])
		);
	});
});
