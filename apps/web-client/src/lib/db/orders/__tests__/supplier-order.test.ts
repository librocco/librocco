import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb } from "./lib";

import { upsertSupplier, associatePublisher, getPossibleSupplerOrders } from "../suppliers";
import { upsertCustomer, addBooksToCustomer } from "../customers";
import { upsertBook } from "../books";

describe("Suppliers order creation", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		// Add three books
		await upsertBook(db, { isbn: "1", publisher: "MathsAndPhysicsPub", title: "Physics" });
		await upsertBook(db, { isbn: "2", publisher: "ChemPub", title: "Chemistry" });
		await upsertBook(db, { isbn: "3", publisher: "PhantasyPub", title: "The Hobbit" });

		// Two customers order some books
		await upsertCustomer(db, { fullname: "John Doe", id: 1 });
		addBooksToCustomer(db, 1, [
			{ isbn: "1", quantity: 1 },
			{ isbn: "2", quantity: 1 },
			{ isbn: "3", quantity: 1 }
		]);

		await upsertCustomer(db, { fullname: "Jane Doe", id: 2 });
		addBooksToCustomer(db, 2, [{ isbn: "3", quantity: 1 }]);

		// We have two different suppliers
		await upsertSupplier(db, { id: 1, name: "Science Books LTD" });
		await upsertSupplier(db, { id: 2, name: "Phantasy Books LTD" });
		// Publishers are associated with suppliers
		await associatePublisher(db, 1, "MathsAndPhysicsPub");
		await associatePublisher(db, 1, "ChemPub");
		await associatePublisher(db, 2, "PhantasyPub");
	});

	it("creates a supplier order from a client order", async () => {
		expect(await getPossibleSupplerOrders(db)).toStrictEqual([
			{ supplier_id: 1, isbn: "1", quantity: 1 },
			{ supplier_id: 1, isbn: "2", quantity: 1 },
			{ supplier_id: 2, isbn: "3", quantity: 2 }
		]);
		// If we change the supplier for ChemPub to Phantasy Books LTD
		// the supplier order will reflect that
		await associatePublisher(db, 2, "ChemPub");
		expect(await getPossibleSupplerOrders(db)).toStrictEqual([
			{ supplier_id: 1, isbn: "1", quantity: 1 },
			{ supplier_id: 2, isbn: "2", quantity: 1 }, // This is now from supplier 2
			{ supplier_id: 2, isbn: "3", quantity: 2 }
		]);
	});
});
