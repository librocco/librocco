import { describe, it, expect } from "vitest";
import { getRandomDb } from "./lib";

import {
	getAllSuppliers,
	upsertSupplier,
	getPublishersFor,
	associatePublisher,
	getSupplierDetails,
	removePublisherFromSupplier
} from "../suppliers";

// Test fixtures
const supplier1 = {
	id: 1,
	name: "Science Books LTD",
	customerId: 111,
	email: "contact@science.books",
	address: "123 Science St",
	numPublishers: 0
};
const supplier2 = {
	id: 2,
	name: "Fantasy Books LTD",
	customerId: 222,
	email: "info@fantasy.books",
	address: "456 Fantasy Ave",
	numPublishers: 0
};
const supplier3 = {
	id: 3,
	name: "History Books LTD",
	customerId: 333,
	email: "hello@history.books",
	address: "789 History Rd",
	numPublishers: 0
};

const publisher1 = "AnimalPublisher";
const publisher2 = "FantasyPublisher";
const publisher3 = "XanaxPublisher";

describe("Supplier management:", () => {
	describe("upsertSupplier should", () => {
		it("reject supplier without id", async () => {
			const db = await getRandomDb();
			await expect(upsertSupplier(db, { name: "Invalid Supplier" })).rejects.toThrow("Supplier must have an id");
		});

		it("create new supplier with all fields", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			const suppliers = await getSupplierDetails(db, supplier1.id);
			expect(suppliers).toEqual(supplier1);
		});

		it("create new supplier with partial fields", async () => {
			const db = await getRandomDb();
			const partialSupplier = { id: 1, name: "Partial Books" };
			await upsertSupplier(db, partialSupplier);

			const suppliers = await getSupplierDetails(db, supplier1.id);
			expect(suppliers).toEqual({
				id: 1,
				name: "Partial Books",

				customerId: null,
				email: null,
				address: null,
				numPublishers: 0
			});
		});

		it("update existing supplier fields", async () => {
			const db = await getRandomDb();

			// Create initial supplier
			await upsertSupplier(db, supplier1);

			// Update some fields
			const updates = {
				id: supplier1.id,
				name: "Updated Science Books",
				email: "new@science.books"
			};
			await upsertSupplier(db, updates);

			const suppliers = await getAllSuppliers(db);
			expect(suppliers).toEqual([
				{
					...supplier1,
					name: updates.name,
					email: updates.email
				}
			]);
		});

		it("only update provided fields", async () => {
			const db = await getRandomDb();

			// Create initial supplier
			await upsertSupplier(db, supplier1);

			// Update only name
			await upsertSupplier(db, {
				id: supplier1.id,
				name: "Updated Name"
			});

			const suppliers = await getAllSuppliers(db);
			expect(suppliers).toEqual([
				{
					...supplier1,
					name: "Updated Name"
				}
			]);
		});
	});

	describe("getAllSuppliers should", () => {
		it("return empty array when no suppliers exist", async () => {
			const db = await getRandomDb();
			const suppliers = await getAllSuppliers(db);
			expect(suppliers).toEqual([]);
		});

		it("return all suppliers ordered by id", async () => {
			const db = await getRandomDb();

			// Create suppliers in non-sequential order
			await upsertSupplier(db, supplier2);
			await upsertSupplier(db, supplier3);
			await upsertSupplier(db, supplier1);

			const suppliers = await getAllSuppliers(db);
			expect(suppliers).toEqual([supplier1, supplier2, supplier3]);
		});
	});

	it("retrieves data for single supplier by id", async () => {
		const db = await getRandomDb();

		await upsertSupplier(db, { id: 1, name: "Science Books LTD", customerId: 111 });
		await upsertSupplier(db, {
			id: 2,
			name: "Fantasy Books LTD",
			email: "info@fantasy.com",
			address: "123 Yellow Brick Rd",
			customerId: 222
		});
		await associatePublisher(db, 1, "SciencePublisher");
		await associatePublisher(db, 1, "PhysicsPublisher");

		expect(await getSupplierDetails(db, 1)).toEqual({
			id: 1,
			name: "Science Books LTD",
			address: null,
			email: null,
			customerId: 111,
			numPublishers: 2
		});

		expect(await getSupplierDetails(db, 2)).toEqual({
			id: 2,
			name: "Fantasy Books LTD",
			address: "123 Yellow Brick Rd",
			email: "info@fantasy.com",
			customerId: 222,
			numPublishers: 0
		});

		// Non-existent supplier
		expect(await getSupplierDetails(db, 3)).toEqual(undefined);
	});
});

describe("Publisher associations:", () => {
	describe("associatePublisher should", () => {
		it("create new publisher association", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			await associatePublisher(db, supplier1.id, publisher1);

			const publishers = await getPublishersFor(db, supplier1.id);
			expect(publishers).toEqual([publisher1]);
		});

		it("transfer publisher association between suppliers", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);
			await upsertSupplier(db, supplier2);

			// Initially associate with supplier1
			await associatePublisher(db, supplier1.id, publisher1);

			// Transfer to supplier2
			await associatePublisher(db, supplier2.id, publisher1);

			// Check associations
			const supplier1Publishers = await getPublishersFor(db, supplier1.id);
			const supplier2Publishers = await getPublishersFor(db, supplier2.id);

			expect(supplier1Publishers).toEqual([]);
			expect(supplier2Publishers).toEqual([publisher1]);
		});

		it("handle multiple publisher associations", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			// Associate multiple publishers
			await associatePublisher(db, supplier1.id, publisher1);
			await associatePublisher(db, supplier1.id, publisher2);

			const publishers = await getPublishersFor(db, supplier1.id);
			expect(publishers).toEqual([publisher1, publisher2]);
		});
	});

	describe("getAllSuppliers shold", () => {
		it("the correct 'numPublishers'", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			// NOTE: supplier1 has 'numPublishers' = 0
			expect(await getSupplierDetails(db, 1)).toEqual(expect.objectContaining({ numPublishers: 0 }));

			await associatePublisher(db, supplier1.id, publisher1);
			expect(await getSupplierDetails(db, 1)).toEqual(expect.objectContaining({ numPublishers: 1 }));

			await associatePublisher(db, supplier1.id, publisher2);
			expect(await getSupplierDetails(db, 1)).toEqual(expect.objectContaining({ numPublishers: 2 }));

			await removePublisherFromSupplier(db, supplier1.id, publisher2);
			expect(await getSupplierDetails(db, 1)).toEqual(expect.objectContaining({ numPublishers: 1 }));
		});
	});

	describe("getPublishersFor should", () => {
		it("return empty array for supplier with no publishers", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			const publishers = await getPublishersFor(db, supplier1.id);
			expect(publishers).toEqual([]);
		});
		it("return array for assigned publishers for all suppliers", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			// Associate multiple publishers
			await associatePublisher(db, supplier1.id, publisher1);
			await associatePublisher(db, supplier1.id, publisher2);
			await associatePublisher(db, supplier1.id, publisher3);

			const publishers = await getPublishersFor(db);
			expect(publishers).toEqual([publisher1, publisher2, publisher3]);
		});

		it("return empty array for non-existent supplier", async () => {
			const db = await getRandomDb();
			const publishers = await getPublishersFor(db, 999);
			expect(publishers).toEqual([]);
		});

		it("return all associated publishers ordered alphabetically", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			// Associate multiple publishers
			await associatePublisher(db, supplier1.id, publisher1);
			await associatePublisher(db, supplier1.id, publisher2);
			await associatePublisher(db, supplier1.id, publisher3);

			const publishers = await getPublishersFor(db, supplier1.id);
			expect(publishers).toEqual([publisher1, publisher2, publisher3]);
		});
	});
});
