/* eslint-disable no-case-declarations */
import { beforeEach, describe, expect, test } from "vitest";

import { testUtils } from "@librocco/shared";

import { newTestDB } from "@/__testUtils__/db";
import { inventoryDb } from "../index";
import { addAndCommitNotes, TestNote } from "@/__testUtils__/misc";
import { InventoryDatabaseInterface } from "../types";
import { versionId } from "../utils";

const { waitFor } = testUtils;

// Using 'describe.each' allows us to run tests against each version of the db interface implementation.
describe("Implementation specific unit tests", () => {
	let db = newTestDB(inventoryDb) as InventoryDatabaseInterface;

	// Initialise a new db for each test
	beforeEach(async () => {
		db = newTestDB(inventoryDb);
		await db.init();
		await db.warehouse("wh1").create();
	});

	test("stock - init: should create a stock archive document (if there's any stock to archive)", async () => {
		// No stock archive
		const { entries } = await db.archive().stock().get();
		expect(entries).toEqual([]);

		await addAndCommitNotes(db, baseNotes);

		// Should crete a new doc
		await db.stock().init();

		await waitFor(async () => {
			const { entries } = await db.archive().stock().get();
			expect(entries).toEqual(baseStock);
		});
	});

	test("stock - init: if stock archive doc is out of date, should update - start of current month stock", async () => {
		// Commit the notes and add outdated archive
		await addAndCommitNotes(db, baseNotes);
		await db.archive().stock().upsert({}, "2023-01-01", baseStock); // This archive is correct, but out of date

		// Create additional warehouse (to shake things up a bit)
		await db.warehouse("wh2").create();

		const { month, entries } = await db.archive().stock().get();
		expect(entries).toEqual(baseStock);
		expect(month).toEqual("2023-01-01");

		// Add more recent notes
		await addAndCommitNotes(db, [
			{
				type: "inbound",
				date: "2023-02-01",
				warehouseId: "wh2",
				entries: [{ isbn: "1111111111", warehouseId: "wh2", quantity: 2 }]
			}
		]);

		// Should crete a new doc
		await db.stock().init();

		await waitFor(async () => {
			const { month, entries } = await db.archive().stock().get();
			expect(month).toEqual(new Date().toISOString().slice(0, 7));
			expect(entries).toEqual([
				...baseStock,
				{
					isbn: "1111111111",
					warehouseId: versionId("wh2"),
					quantity: 2
				}
			]);
		});
	});

	test("stock - init: notes for the running month shouldn't be included in the stock archive", async () => {
		// Commit the notes and add outdated archive
		await addAndCommitNotes(db, baseNotes);
		await db.archive().stock().upsert({}, "2023-01-01", baseStock); // This archive is correct, but out of date

		// Create additional warehouse (to shake things up a bit)
		await db.warehouse("wh2").create();

		const { month, entries } = await db.archive().stock().get();
		expect(entries).toEqual(baseStock);
		expect(month).toEqual("2023-01-01");

		// Add a note in the running month
		const today = new Date().toISOString().slice(0, 10);
		await addAndCommitNotes(db, [
			{
				type: "inbound",
				date: today,
				warehouseId: "wh2",
				entries: [{ isbn: "1111111111", warehouseId: "wh2", quantity: 2 }]
			}
		]);

		// Should crete a new doc
		await db.stock().init();

		await waitFor(async () => {
			const { month, entries } = await db.archive().stock().get();
			expect(month).toEqual(new Date().toISOString().slice(0, 7));
			expect(entries).toEqual(baseStock);
		});
	});

	test("stock - init: when updating archive to be up-to-date, if there's no diff, only the month should be updated", async () => {
		// Commit the notes and add outdated archive
		await addAndCommitNotes(db, baseNotes);
		await db.archive().stock().upsert({}, "2023-01-01", baseStock); // This archive is correct, but out of date

		// Create additional warehouse (to shake things up a bit)
		await db.warehouse("wh2").create();

		const { month, entries } = await db.archive().stock().get();
		expect(entries).toEqual(baseStock);
		expect(month).toEqual("2023-01-01");

		// Should crete a new doc
		await db.stock().init();

		await waitFor(async () => {
			const { month, entries } = await db.archive().stock().get();
			expect(month).toEqual(new Date().toISOString().slice(0, 7));
			expect(entries).toEqual(baseStock);
		});
	});
});

/** The notes used as seed data for all tests */
const baseNotes: TestNote[] = [
	{
		type: "inbound",
		date: "2021-01-01",
		warehouseId: "wh1",
		entries: [
			{
				isbn: "1111111111",
				quantity: 2,
				warehouseId: "wh1"
			},
			{
				isbn: "2222222222",
				quantity: 1,
				warehouseId: "wh1"
			},
			{
				isbn: "3333333333",
				quantity: 3,
				warehouseId: "wh1"
			}
		]
	},
	{
		type: "outbound",
		date: "2022-01-01",
		entries: [
			{
				isbn: "1111111111",
				quantity: 1,
				warehouseId: "wh1"
			},
			{
				isbn: "2222222222",
				quantity: 1,
				warehouseId: "wh1"
			}
		]
	}
];

/** Stock after seed notes have been added and committed */
const baseStock = [
	{
		isbn: "1111111111",
		quantity: 1,
		warehouseId: versionId("wh1")
	},
	{
		isbn: "3333333333",
		quantity: 3,
		warehouseId: versionId("wh1")
	}
];

const TIME_DAY = 1000 * 60 * 60 * 24;
// #endregion
