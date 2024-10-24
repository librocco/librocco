import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb } from "./lib";

import {
	upsertSupplier,
	associatePublisher,
	getPossibleSupplerOrderLines,
	getPossibleSupplerOrderInfos,
	createSupplierOrder
} from "../suppliers";
import { upsertCustomer, addBooksToCustomer, getCustomerBooks } from "../customers";
import { upsertBook } from "../books";

describe("Suppliers order creation", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		// Add three books
		await upsertBook(db, { isbn: "1", publisher: "MathsAndPhysicsPub", title: "Physics", price: 7 });
		await upsertBook(db, { isbn: "2", publisher: "ChemPub", title: "Chemistry", price: 13 });
		await upsertBook(db, { isbn: "3", publisher: "PhantasyPub", title: "The Hobbit", price: 5 });

		// There is an old order that has been completely fullfilled
		await upsertCustomer(db, { fullname: "An older order", id: 100 });
		const sql =
			"INSERT INTO customer_order_lines (customer_id, isbn, quantity, created, placed, received, collected) VALUES (?, ?, ?, ?, ?, ?, ?);";
		const params = [
			100,
			"1",
			"1",
			new Date("2024-10-20").getTime(),
			new Date("2024-10-21").getTime(),
			new Date("2024-10-22").getTime(),
			new Date("2024-10-23").getTime()
		];
		await db.exec(sql, params);

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

	it("sees possible supplier orders from client orders", async () => {
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
	it.only("creates two new supplier orders", async () => {
		const possibleOrderLines = await getPossibleSupplerOrderLines(db);
		const newOrders = await createSupplierOrder(db, possibleOrderLines);
		expect(newOrders.length).toStrictEqual(2);
		const newPossibleOrderLines = await getPossibleSupplerOrderLines(db);
		expect(newPossibleOrderLines.length).toStrictEqual(0);
		const customer1Books = await getCustomerBooks(db, 1);
		console.log(customer1Books);
	});
});
