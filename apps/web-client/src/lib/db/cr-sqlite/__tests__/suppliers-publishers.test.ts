import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb } from "./lib";

import { getAllSuppliers, upsertSupplier, getPublishersFor, associatePublisher } from "../suppliers";

describe("Suppliers CRUD tests", () => {
	it("retrieves all suppliers, with their assigned publishers", async () => {
		const db = await getRandomDb();

		await upsertSupplier(db, { id: 1, name: "Science Books LTD" });
		expect(await getAllSuppliers(db)).toEqual([{ id: 1, name: "Science Books LTD", address: "N/A", email: "N/A", assignedPublishers: [] }]);

		await upsertSupplier(db, { id: 2, name: "Fantasy Books LTD", email: "info@fantasy.com", address: "123 Yellow Brick Rd" });
		expect(await getAllSuppliers(db)).toEqual([
			{ id: 1, name: "Science Books LTD", address: "N/A", email: "N/A", assignedPublishers: [] },
			{ id: 2, name: "Fantasy Books LTD", email: "info@fantasy.com", address: "123 Yellow Brick Rd", assignedPublishers: [] }
		]);

		await associatePublisher(db, 1, "SciencePublisher");
		expect(await getAllSuppliers(db)).toEqual([
			{ id: 1, name: "Science Books LTD", address: "N/A", email: "N/A", assignedPublishers: ["SciencePublisher"] },
			{ id: 2, name: "Fantasy Books LTD", email: "info@fantasy.com", address: "123 Yellow Brick Rd", assignedPublishers: [] }
		]);

		await associatePublisher(db, 1, "PhysicsPublisher");
		expect(await getAllSuppliers(db)).toEqual([
			{ id: 1, name: "Science Books LTD", address: "N/A", email: "N/A", assignedPublishers: ["PhysicsPublisher", "SciencePublisher"] },
			{ id: 2, name: "Fantasy Books LTD", email: "info@fantasy.com", address: "123 Yellow Brick Rd", assignedPublishers: [] }
		]);

		await associatePublisher(db, 2, "FantasyPublisher");
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
