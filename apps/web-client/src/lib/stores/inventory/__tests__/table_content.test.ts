import { describe, test, expect } from "vitest";
import { testUtils } from "@librocco/shared";

import type { PaginationData, DisplayRow } from "$lib/types/inventory";

import { createDisplayEntriesStore, createPaginationDataStore } from "../table_content";

import type { VolumeQuantity } from "$lib/types/db";
import { readable } from "svelte/store";
import { newTestDB } from "$lib/__testUtils__/db";
const { waitFor } = testUtils;

describe("tableContentStore", () => {
	test("should not explode if no 'entity' is provided", async () => {
		let displayEntries: VolumeQuantity[] | undefined;

		// Both db and entity are undefined (this will happen at build time, as db is instantiated only in browser)
		let de$ = createDisplayEntriesStore({}, undefined, undefined, readable(0));
		de$.subscribe((de) => (displayEntries = de));
		expect(displayEntries).toEqual([]);

		// Reset the 'displayEntries'
		displayEntries = undefined;

		// Should also work if db is defined but entity is undefined (this might happen if the entity id is not specified)
		const db = await newTestDB();
		de$ = createDisplayEntriesStore({}, db, undefined, readable(0));
		de$.subscribe((de) => (displayEntries = de));
		expect(displayEntries).toEqual([]);

		// Same check for pagination
		const pd$ = createPaginationDataStore({}, undefined, readable(0));
		let paginationData: PaginationData | undefined;
		pd$.subscribe((pd) => (paginationData = pd));
		expect(paginationData).toEqual({
			numPages: 0,
			firstItem: 0,
			lastItem: 0,
			totalItems: 0
		} as PaginationData);
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

		const de$ = createDisplayEntriesStore({}, db, note, readable(0));
		let displayEntries: DisplayRow[];
		de$.subscribe((de) => (displayEntries = de));

		// Should receive the initial state (only book1 transaction in the note)
		await waitFor(() =>
			expect(displayEntries).toEqual([{ ...book1, quantity: 12, warehouseId: `v1/jazz`, warehouseName: "not-found" }])
		);

		// Update the note (add additional transactions)
		await note.addVolumes(
			{ isbn: book2.isbn, quantity: 10, warehouseId: "jazz" },
			{ isbn: book3.isbn, quantity: 5, warehouseId: "jazz" }
		);
		await waitFor(() => {
			expect(displayEntries).toEqual([
				{ ...book1, quantity: 12, warehouseId: `v1/jazz`, warehouseName: "not-found" },
				// Book data for book2 is already available in the db
				{ ...book2, quantity: 10, warehouseId: `v1/jazz`, warehouseName: "not-found" },
				// Book data for book3 is not available in the db - only the transaction data is shown
				{ isbn: book3.isbn, quantity: 5, warehouseId: `v1/jazz`, warehouseName: "not-found" }
			]);
		});

		// Update book data for book3
		await db.books().upsert([book3]);
		await waitFor(() => {
			expect(displayEntries).toEqual([
				{ ...book1, quantity: 12, warehouseId: `v1/jazz`, warehouseName: "not-found" },
				{ ...book2, quantity: 10, warehouseId: `v1/jazz`, warehouseName: "not-found" },
				// Full book3 data should be displayed
				{ ...book3, quantity: 5, warehouseId: `v1/jazz`, warehouseName: "not-found" }
			]);
		});

		// Update the first book data
		await db.books().upsert([{ ...book1, title: "The Age of Wonder (updated)" }]);
		// The update should be reflected in the resulting stream
		await waitFor(() => {
			expect(displayEntries).toEqual([
				{
					...book1,
					title: "The Age of Wonder (updated)",
					quantity: 12,
					warehouseId: `v1/jazz`,
					warehouseName: "not-found"
				},
				{ ...book2, quantity: 10, warehouseId: `v1/jazz`, warehouseName: "not-found" },
				{ ...book3, quantity: 5, warehouseId: `v1/jazz`, warehouseName: "not-found" }
			]);
		});
	});
});
