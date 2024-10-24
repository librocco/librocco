import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb } from "./lib";

import { getAllSuppliers, upsertSupplier, getPublishersFor, associatePublisher } from "../suppliers";

describe("Suppliers CRUD tests", () => {
	let db: DB;
	beforeEach(async () => (db = await getRandomDb()));

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
	beforeEach(async () => (db = await getRandomDb()));

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
