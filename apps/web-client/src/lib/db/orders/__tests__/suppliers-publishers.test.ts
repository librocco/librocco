import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getDB, initializeDB } from "../db";

import { getAllSuppliers, upsertSupplier, getPublishersFor, associatePublisher } from "../suppliers";

describe("Suppliers CRUD tests", () => {
	let db: DB;
	// Each test run will use a different db
	// birthday paradox chance of collision for 1k runs is 0.5%)
	let randomTestRunId: number;

	beforeEach(async () => {
		randomTestRunId = Math.floor(Math.random() * 100000000);
		db = await getDB("testdb" + randomTestRunId);
		await initializeDB(db);
	});

	it("can create and update a supplier", async () => {
		await expect(upsertSupplier(db, { name: "Science Books LTD" })).rejects.toThrow("Supplier must have an id");
		await upsertSupplier(db, { id: 1, name: "Science Books LTD" });
		let suppliers = await getAllSuppliers(db);
		expect(suppliers.length).toBe(1);
		await upsertSupplier(db, { id: 2, name: "Phantasy Books LTD" });
		suppliers = await getAllSuppliers(db);
		expect(suppliers.length).toBe(2);
		await upsertSupplier(db, { id: 1, name: "Science Books inc." });
		suppliers = await getAllSuppliers(db);
		expect(suppliers.length).toBe(2);
	});
});

describe("Suppliers/publisher association tests", () => {
	let db: DB;
	// Each test run will use a different db
	// birthday paradox chance of collision for 1k runs is 0.5%)
	let randomTestRunId: number;

	beforeEach(async () => {
		randomTestRunId = Math.floor(Math.random() * 100000000);
		db = await getDB("testdb" + randomTestRunId);
		await initializeDB(db);
		await upsertSupplier(db, { id: 1, name: "Science Books LTD" });
		await upsertSupplier(db, { id: 2, name: "Fiction Books LTD" });
	});

	it("can assign publishers to suppliers", async () => {
		let sciencePublishers = await getPublishersFor(db, 1);
		expect(sciencePublishers.length).toBe(0);

		await associatePublisher(db, 1, "SciencePublisher");
		sciencePublishers = await getPublishersFor(db, 1);
		expect(sciencePublishers).toStrictEqual(["SciencePublisher"]);

		await associatePublisher(db, 2, "SciencePublisher");
		sciencePublishers = await getPublishersFor(db, 1);
		expect(sciencePublishers).toStrictEqual([]);
		const fictionPublishers = await getPublishersFor(db, 2);
		expect(fictionPublishers).toStrictEqual(["SciencePublisher"]);
	});
});
