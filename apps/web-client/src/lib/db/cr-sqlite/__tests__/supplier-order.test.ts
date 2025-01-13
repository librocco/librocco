import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import {
	associatePublisher,
	getPlacedSupplierOrders,
	getPossibleSupplierOrderLines,
	getPossibleSupplierOrders,
	createSupplierOrder,
	getPlacedSupplierOrderLines
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
	it("retrieves possible order lines for a specific supplier from unplaced customer orders", async () => {
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

	it("creates new supplier orders", async () => {
		const possibleOrderLines = await getPossibleSupplierOrderLines(db, 1);

		await createSupplierOrder(db, possibleOrderLines);

		const newOrders = await getPlacedSupplierOrders(db);

		expect(newOrders.length).toBe(1);

		const newPossibleOrderLines = await getPossibleSupplierOrderLines(db, 1);
		expect(newPossibleOrderLines.length).toBe(0);
	});

	describe("placed supplier orders:", () => {
		it("retrieves a list of placed supplier orders", async () => {
			// Create two supplier orders using the existing test data
			await db.exec(`
				INSERT INTO supplier_order (id, supplier_id, created)
				VALUES
				(1, 1, strftime('%s', 'now') * 1000),
				(2, 2, strftime('%s', 'now') * 1000)
			`);

			await db.exec(`
				INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, '1', 2),
				(1, '2', 1),
				(2, '3', 3)
			`);

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

		// TODO: should this be possible?
		it("handles orders with no order lines", async () => {
			// Create orders but no order lines
			await db.exec(`
				INSERT INTO supplier_order (id, supplier_id, created)
				VALUES
				(1, 1, strftime('%s', 'now') * 1000),
				(2, 2, strftime('%s', 'now') * 1000)
			`);

			const orders = await getPlacedSupplierOrders(db);
			expect(orders).toHaveLength(2);
			orders.forEach((order) => {
				expect(order.total_book_number).toBe(0);
			});
		});
	});
});

describe("getPlacedSupplierOrderLines", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		// Set up test data
		await createCustomerOrders(db);
		// Create two supplier orders using the existing test data
		await db.exec(`
			INSERT INTO supplier_order (id, supplier_id, created)
			VALUES
			(1, 1, strftime('%s', 'now') * 1000),
			(2, 2, strftime('%s', 'now') * 1000)
		`);

		await db.exec(`
			INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
			VALUES
			(1, '3', 2),
			(1, '1', 2),
			(1, '2', 1),
			(2, '3', 3)
		`);
	});

	it("should retrieve a single supplier order with its line items", async () => {
		const order = await getPlacedSupplierOrderLines(db, 1);

		expect(order).toEqual([
			{
				supplier_id: 1,
				authors: null,
				isbn: "1",
				price: 7,
				publisher: "MathsAndPhysicsPub",
				quantity: 2,
				supplier_order_id: 1,
				title: "Physics",
				total_book_number: 5,
				total_price: 37,
				supplier_name: "Science Books LTD",
				created: expect.any(Number)
			},
			{
				authors: null,
				isbn: "2",
				price: 13,
				publisher: "ChemPub",
				quantity: 1,
				supplier_id: 1,
				supplier_order_id: 1,
				title: "Chemistry",
				total_book_number: 5,
				total_price: 37,
				supplier_name: "Science Books LTD",
				created: expect.any(Number)
			},
			{
				authors: null,
				isbn: "3",
				price: 5,
				publisher: "PhantasyPub",
				quantity: 2,
				supplier_id: 1,
				supplier_order_id: 1,
				title: "The Hobbit",
				total_book_number: 5,
				total_price: 37,
				supplier_name: "Science Books LTD",
				created: expect.any(Number)
			}
		]);
	});

	it("should return empty array for non-existent order", async () => {
		const order = await getPlacedSupplierOrderLines(db, 999);
		expect(order).toHaveLength(0);
	});

	it("should calculate correct totals for multiple line items", async () => {
		const orderLines = await getPlacedSupplierOrderLines(db, 1);

		orderLines.forEach((line) => {
			expect(line.total_book_number).toBe(5);
			expect(line.total_price).toBe(37);
		});

		expect(orderLines).toHaveLength(3);
	});

	it("should handle books with null prices", async () => {
		// Add a book with null price
		await db.exec(`
         UPDATE book SET price = NULL WHERE isbn = '1';
     `);

		const orderLines = await getPlacedSupplierOrderLines(db, 1);
		expect(orderLines).toHaveLength(3);
		expect(orderLines[0].total_price).toBe(23);
	});

	it("should handle large quantities and prices", async () => {
		// Update to large numbers
		await db.exec(`
         UPDATE book SET price = 999999.99 WHERE isbn = '1';
         UPDATE supplier_order_line SET quantity = 999999 WHERE isbn = '1';
     `);

		const orderLines = await getPlacedSupplierOrderLines(db, 1);
		expect(orderLines).toHaveLength(3);
		expect(orderLines[0].total_price).toBeGreaterThan(900000000);
	});
});
