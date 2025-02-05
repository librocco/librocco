import { describe, it, expect } from "vitest";
import { type DB } from "../types";
import { getRandomDb } from "./lib";
import { getAllSuppliers, upsertSupplier, getPublishersFor, associatePublisher } from "../suppliers";

// Test fixtures
const supplier1 = { id: 1, name: "Science Books LTD", email: "contact@science.books", address: "123 Science St" };
const supplier2 = { id: 2, name: "Fantasy Books LTD", email: "info@fantasy.books", address: "456 Fantasy Ave" };
const supplier3 = { id: 3, name: "History Books LTD", email: "hello@history.books", address: "789 History Rd" };

const publisher1 = "SciencePublisher";
const publisher2 = "FantasyPublisher";
const publisher3 = "HistoryPublisher";

describe("Supplier management:", () => {
	describe("upsertSupplier should", () => {
		it("reject supplier without id", async () => {
			const db = await getRandomDb();
			await expect(upsertSupplier(db, { name: "Invalid Supplier" })).rejects.toThrow("Supplier must have an id");
		});

		it("create new supplier with all fields", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			const suppliers = await getAllSuppliers(db);
			expect(suppliers).toEqual([supplier1]);
		});

		it("create new supplier with partial fields", async () => {
			const db = await getRandomDb();
			const partialSupplier = { id: 1, name: "Partial Books" };
			await upsertSupplier(db, partialSupplier);

			const suppliers = await getAllSuppliers(db);
			expect(suppliers).toEqual([
				{
					id: 1,
					name: "Partial Books",
					email: null,
					address: null
				}
			]);
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

	describe("getPublishersFor should", () => {
		it("return empty array for supplier with no publishers", async () => {
			const db = await getRandomDb();
			await upsertSupplier(db, supplier1);

			const publishers = await getPublishersFor(db, supplier1.id);
			expect(publishers).toEqual([]);
		});

		it("return empty array for non-existent supplier", async () => {
			const db = await getRandomDb();
			const publishers = await getPublishersFor(db, 999);
			expect(publishers).toEqual([]);
		});

		it("return all associated publishers", async () => {
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
