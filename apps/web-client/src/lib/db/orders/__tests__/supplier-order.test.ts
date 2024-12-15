import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import {
	associatePublisher,
	getPlacedSupplierOrders,
	getPossibleSupplierOrderLines,
	getPossibleSupplierOrders,
	createSupplierOrder
} from "../suppliers";

describe("Supplier order handlers should", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
	});

	it("list all pending supplier orders from unplaced customer order lines", async () => {
		// Customer order lines can be aggregated into these suppliers.
		// The aggregation includes the total number of books and total price
		expect(await getPossibleSupplierOrders(db)).toStrictEqual([
			{ supplier_name: "Phantasy Books LTD", supplier_id: 2, total_book_number: 2, total_book_price: 10 },
			{ supplier_name: "Science Books LTD", supplier_id: 1, total_book_number: 2, total_book_price: 20 }
		]);
	});

	// TODO: export and match to test data instead of all of this duplication
	it("Retrieves possible order lines for a specific supplier from unplaced customer orders", async () => {
		// Supplier 1 should have the following lines
		expect(await getPossibleSupplierOrderLines(db, 1)).toEqual([
			{
				supplier_id: 1,
				supplier_name: "Science Books LTD",
				isbn: "1",
				publisher: "MathsAndPhysicsPub",
				authors: null,
				title: "Physics",
				quantity: 1,
				line_price: 7
			},
			{
				supplier_id: 1,
				supplier_name: "Science Books LTD",
				isbn: "2",
				publisher: "ChemPub",
				authors: null,
				title: "Chemistry",
				quantity: 1,
				line_price: 13
			}
		]);
		// Supplier 2 lines should have the following lines
		expect(await getPossibleSupplierOrderLines(db, 2)).toEqual([
			{
				supplier_id: 2,
				supplier_name: "Phantasy Books LTD",
				isbn: "3",
				publisher: "PhantasyPub",
				authors: null,
				title: "The Hobbit",
				quantity: 2,
				line_price: 10
			}
		]);

		// If we change the supplier for ChemPub to Phantasy Books LTD
		// the supplier order will reflect that
		await associatePublisher(db, 2, "ChemPub");
		expect(await getPossibleSupplierOrderLines(db, 2)).toEqual([
			// This is now from supplier 2
			{
				supplier_id: 2,
				supplier_name: "Phantasy Books LTD",
				isbn: "2",
				publisher: "ChemPub",
				authors: null,
				title: "Chemistry",
				quantity: 1,
				line_price: 13
			},
			{
				supplier_id: 2,
				supplier_name: "Phantasy Books LTD",
				isbn: "3",
				publisher: "PhantasyPub",
				authors: null,
				title: "The Hobbit",
				quantity: 2,
				line_price: 10
			}
		]);
	});

	it("creates two new supplier orders", async () => {
		const possibleOrderLines = await getPossibleSupplierOrderLines(db, 1);

		const newOrders = await createSupplierOrder(db, possibleOrderLines);
		expect(newOrders.length).toBe(1);

		const newPossibleOrderLines = await getPossibleSupplierOrderLines(db, 1);
		expect(newPossibleOrderLines.length).toBe(0);
	});

	it("gets all supplier orders with correct totals", async () => {
		// Create two supplier orders using the existing test data
		await db.exec(`INSERT INTO supplier_order (id, supplier_id, created)
VALUES
(1, 1, strftime('%s', 'now') * 1000),
(2, 2, strftime('%s', 'now') * 1000)`);

		await db.exec(`INSERT INTO supplier_order_line (supplier_order_id, isbn,
quantity) VALUES
(1, '1', 2),
(1, '2', 1),
(2, '3', 3)`);

		const orders = await getPlacedSupplierOrders(db);

		expect(orders).toHaveLength(2);
		expect(orders).toEqual([
			expect.objectContaining({
				id: 1,
				supplier_id: 1,
				supplier_name: "Science Books LTD",
				total_book_number: 3, // 2 Physics + 1 Chemistry
				created: expect.any(Number)
			}),
			expect.objectContaining({
				id: 2,
				supplier_id: 2,
				supplier_name: "Phantasy Books LTD",
				total_book_number: 3, // 3 copies of The Hobbit
				created: expect.any(Number)
			})
		]);
	});

	it("returns empty array when no orders exist", async () => {
		const orders = await getPlacedSupplierOrders(db);
		expect(orders).toEqual([]);
	});

	it("handles orders with no order lines", async () => {
		// Create orders but no order lines
		await db.exec(`INSERT INTO supplier_order (id, supplier_id, created)
VALUES
(1, 1, strftime('%s', 'now') * 1000),
(2, 2, strftime('%s', 'now') * 1000)`);

		const orders = await getPlacedSupplierOrders(db);
		expect(orders).toHaveLength(2);
		orders.forEach((order) => {
			expect(order.total_book_number).toBe(0);
		});
	});
});
