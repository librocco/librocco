import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb } from "./lib";

import { upsertSupplier, associatePublisher, getPossibleSupplerOrderLines, getPossibleSupplerOrderInfos } from "../suppliers";
import { upsertCustomer, addBooksToCustomer } from "../customers";
import { upsertBook } from "../books";

describe("Suppliers order creation", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		// Add three books
		await upsertBook(db, { isbn: "1", publisher: "MathsAndPhysicsPub", title: "Physics", price: 7 });
		await upsertBook(db, { isbn: "2", publisher: "ChemPub", title: "Chemistry", price: 13 });
		await upsertBook(db, { isbn: "3", publisher: "PhantasyPub", title: "The Hobbit", price: 5 });

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
		expect(await getPossibleSupplerOrderLines(db)).toStrictEqual([
			{ supplier_id: 1, isbn: "1", quantity: 1 },
			{ supplier_id: 1, isbn: "2", quantity: 1 },
			{ supplier_id: 2, isbn: "3", quantity: 2 }
		]);
		expect(await getPossibleSupplerOrderInfos(db)).toStrictEqual([
			{ supplier_name: "Science Books LTD", supplier_id: 1, total_book_number: 2, total_book_price: 20 },
			{ supplier_name: "Phantasy Books LTD", supplier_id: 2, total_book_number: 2, total_book_price: 10 }
		]);
		// If we change the supplier for ChemPub to Phantasy Books LTD
		// the supplier order will reflect that
		await associatePublisher(db, 2, "ChemPub");
		expect(await getPossibleSupplerOrderLines(db)).toStrictEqual([
			{ supplier_id: 1, isbn: "1", quantity: 1 },
			{ supplier_id: 2, isbn: "2", quantity: 1 }, // This is now from supplier 2
			{ supplier_id: 2, isbn: "3", quantity: 2 }
		]);
	});
});