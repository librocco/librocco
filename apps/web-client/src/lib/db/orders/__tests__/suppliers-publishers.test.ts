import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getDB, initializeDB } from "../db";

import { getAllSuppliers, upsertSupplier } from "../suppliers";

describe("Suppliers/publisher association tests", () => {
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
