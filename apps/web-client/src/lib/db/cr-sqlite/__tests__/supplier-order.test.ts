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
import { addBooksToCustomer } from "../customers";

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
			{ supplier_name: "General", supplier_id: null, total_book_number: 2, total_book_price: 100_000_060 },
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
				authors: "N/A",
				title: "Physics",
				quantity: 1,
				line_price: 7
			},
			{
				supplier_id: 1,
				supplier_name: "Science Books LTD",
				isbn: "2",
				authors: "N/A",
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
				authors: "N/A",
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
				authors: "N/A",
				title: "Chemistry",
				quantity: 1,
				line_price: 13
			},
			{
				supplier_id: 2,
				supplier_name: "Phantasy Books LTD",
				isbn: "3",
				authors: "N/A",
				title: "The Hobbit",
				quantity: 2,
				line_price: 10
			}
		]);

		// Retrieves the null supplier order lines as well
		expect(await getPossibleSupplierOrderLines(db, null)).toEqual([
			{
				supplier_id: null,
				supplier_name: "General",
				isbn: "4",
				authors: "Dan Brown",
				title: "The Secret of Secrets",
				quantity: 1,
				line_price: 60
			},
			{
				supplier_id: null,
				supplier_name: "General",
				isbn: "666",
				authors: "Aristide de Torchia",
				title: "The Nine Gates of the Kingdom of Shadows",
				quantity: 1,
				line_price: 100_000_000
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

	it("Aggregates supplier orders lines quantity when getting possible order lines", async () => {
		await addBooksToCustomer(db, 1, ["1", "2", "3"]);
		await addBooksToCustomer(db, 1, ["1", "2", "3"]);
		const possibleOrderLines = await getPossibleSupplierOrderLines(db, 1);
		expect(possibleOrderLines).toEqual([
			{
				authors: "N/A",
				isbn: "1",
				line_price: 21,
				quantity: 3,

				supplier_id: 1,
				supplier_name: "Science Books LTD",
				title: "Physics"
			},
			{
				authors: "N/A",
				isbn: "2",
				quantity: 3,
				line_price: 39,

				supplier_id: 1,
				supplier_name: "Science Books LTD",
				title: "Chemistry"
			}
		]);

		await createSupplierOrder(db, possibleOrderLines);

		await getPlacedSupplierOrders(db);
		const newOrders = await getPlacedSupplierOrderLines(db, [1]);

		expect(newOrders).toEqual([
			{
				authors: "N/A",
				isbn: "1",
				quantity: 3,
				supplier_id: 1,
				supplier_name: "Science Books LTD",
				title: "Physics",
				created: expect.any(Number),
				supplier_order_id: 1,
				total_book_number: 6,
				total_book_price: 60,
				line_price: 21
			},
			{
				authors: "N/A",
				isbn: "2",
				quantity: 3,
				supplier_id: 1,
				supplier_name: "Science Books LTD",
				title: "Chemistry",
				created: expect.any(Number),
				supplier_order_id: 1,
				total_book_number: 6,
				total_book_price: 60,
				line_price: 39
			}
		]);
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

		it("retrieves a list of placed supplier orders, filtered by supplier id", async () => {
			await db.exec(`
				INSERT INTO supplier_order (id, supplier_id, created)
				VALUES
				(1, 1, strftime('%s', 'now') * 1000),
				(2, 2, strftime('%s', 'now') * 1000),
				(3, 1, strftime('%s', 'now') * 1000)
			`);
			await db.exec(`
				INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, '1', 2),
				(1, '2', 1),
				(2, '3', 3),
				(3, '2', 3),
				(3, '3', 3)
			`);

			expect(await getPlacedSupplierOrders(db, 1)).toEqual([
				expect.objectContaining({
					id: 1,
					supplier_id: 1,
					supplier_name: "Science Books LTD",
					total_book_number: 3, // 2 Physics + 1 Chemistry
					created: expect.any(Number)
				}),
				expect.objectContaining({
					id: 3,
					supplier_id: 1,
					supplier_name: "Science Books LTD",
					total_book_number: 6, // 3 Physics + 3 The Hobbit
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

	it("should retrieve order lines for a single supplier", async () => {
		const order = await getPlacedSupplierOrderLines(db, [1]);

		expect(order).toEqual([
			{
				supplier_id: 1,
				authors: "N/A",
				isbn: "1",
				line_price: 14,
				quantity: 2,
				supplier_order_id: 1,
				title: "Physics",
				total_book_number: 5,
				total_book_price: 37,
				supplier_name: "Science Books LTD",
				created: expect.any(Number)
			},
			{
				authors: "N/A",
				isbn: "2",
				line_price: 13,
				quantity: 1,
				supplier_id: 1,
				supplier_order_id: 1,
				title: "Chemistry",
				total_book_number: 5,
				total_book_price: 37,
				supplier_name: "Science Books LTD",
				created: expect.any(Number)
			},
			{
				authors: "N/A",
				isbn: "3",
				line_price: 10,
				quantity: 2,
				supplier_id: 1,
				supplier_order_id: 1,
				title: "The Hobbit",
				total_book_number: 5,
				total_book_price: 37,
				supplier_name: "Science Books LTD",
				created: expect.any(Number)
			}
		]);
	});

	it("should retrieve order lines for multiple suppliers and order results", async () => {
		const orderLines = await getPlacedSupplierOrderLines(db, [1, 2]);

		// The result should be as test above, but we should have the additional supplier_order 2 at the end
		expect(orderLines.length).toBe(4);
		expect(orderLines[3].supplier_order_id).toBe(2);
	});

	it("should return empty array for non-existent order", async () => {
		const order = await getPlacedSupplierOrderLines(db, [999]);
		expect(order).toHaveLength(0);
	});

	it("should calculate correct totals for multiple line items", async () => {
		const orderLines = await getPlacedSupplierOrderLines(db, [1]);

		orderLines.forEach((line) => {
			expect(line.total_book_number).toBe(5);
			expect(line.total_book_price).toBe(37);
		});

		expect(orderLines).toHaveLength(3);
	});

	it("should handle books with null prices", async () => {
		// Add a book with null price
		await db.exec(`
         UPDATE book SET price = NULL WHERE isbn = '1';
     `);

		const orderLines = await getPlacedSupplierOrderLines(db, [1]);
		expect(orderLines).toHaveLength(3);
		expect(orderLines[0].total_book_price).toBe(23);
	});

	it("should handle large quantities and prices", async () => {
		// Update to large numbers
		await db.exec(`
         UPDATE book SET price = 999999.99 WHERE isbn = '1';
         UPDATE supplier_order_line SET quantity = 999999 WHERE isbn = '1';
     `);

		const orderLines = await getPlacedSupplierOrderLines(db, [1]);
		expect(orderLines).toHaveLength(3);
		expect(orderLines[0].total_book_price).toBeGreaterThan(900000000);
	});
});
