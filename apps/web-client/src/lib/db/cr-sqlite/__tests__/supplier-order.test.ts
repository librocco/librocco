import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import {
	DEFAULT_SUPPLIER_NAME,
	upsertSupplier,
	associatePublisher,
	getPlacedSupplierOrders,
	getPossibleSupplierOrderLines,
	getPossibleSupplierOrders,
	createSupplierOrder,
	getPlacedSupplierOrderLines
} from "../suppliers";
import { addBooksToCustomer, upsertCustomer } from "../customers";
import { upsertBook } from "../books";

describe("Possible (new) supplier orders:", () => {
	const customer1 = { fullname: "John Doe", id: 1, displayId: "100" };
	const customer2 = { fullname: "Harry Styles", id: 2, displayId: "100" };

	const book1 = { isbn: "1", publisher: "MathsAndPhysicsPub", title: "Physics", price: 7 };
	const book2 = { isbn: "2", publisher: "ChemPub", title: "Chemistry", price: 13 };
	const books = [book1, book2];

	const supplier1 = { id: 1, name: "Alphabet Books LTD" };
	const supplier2 = { id: 2, name: "Xanax Books LTD" };

	let db: DB;

	beforeEach(async () => {
		db = await getRandomDb();

		// Setup the entities that we're going to need each time, but don't associate them...
		// leave this to the tests for different scenarios
		await upsertCustomer(db, customer1);
		await upsertCustomer(db, customer2);
		await upsertBook(db, book1);
		await upsertBook(db, book2);
		await upsertSupplier(db, supplier1);
		await upsertSupplier(db, supplier2);
	});

	describe("getPossibleSupplierOrders should", () => {
		it("aggregate a supplier order from multiple client orders", async () => {
			const { id: supplierId, name: supplierName } = supplier1;

			// Associate book1 and book2 with the same supplier
			await associatePublisher(db, supplierId, book1.publisher);
			await associatePublisher(db, supplierId, book2.publisher);

			// Add book1 and book2 to different customer orders
			addBooksToCustomer(db, customer1.id, [book1.isbn]);
			addBooksToCustomer(db, customer2.id, [book2.isbn]);

			// There should be one possible supplier order...
			const result = await getPossibleSupplierOrders(db);
			expect(result.length).toBe(1);

			const [supplierOrder] = result;
			expect(supplierOrder.supplier_id).toBe(supplierId);
			expect(supplierOrder.supplier_name).toBe(supplierName);
			// It should include both books from the two customer orders
			expect(supplierOrder.total_book_number).toBe(books.length);
			expect(supplierOrder.total_book_price).toBe(books.reduce((acc, { price }) => acc + price, 0));
		});

		it("aggregate books that are not associated with a supplier into a 'General' order", async () => {
			// Do not associatePublisher

			// Add book1 and book2 to different customer orders
			addBooksToCustomer(db, customer1.id, [book1.isbn]);
			addBooksToCustomer(db, customer2.id, [book2.isbn]);

			// There should be one possible supplier order...
			const result = await getPossibleSupplierOrders(db);
			expect(result.length).toBe(1);

			const [supplierOrder] = result;
			expect(supplierOrder.supplier_id).toBe(null);
			expect(supplierOrder.supplier_name).toBe(DEFAULT_SUPPLIER_NAME);
		});

		it("group supplier orders and order them ascending by supplier name", async () => {
			// Associate book1 and book2 with the different suppliers
			await associatePublisher(db, supplier1.id, book1.publisher);
			await associatePublisher(db, supplier2.id, book2.publisher);

			// Add a book but don't associate it with a supplier
			const rogueBook = { isbn: "666", publisher: "Devil business", title: "The occult", price: 6 };
			await upsertBook(db, rogueBook);

			// Add books to a customer order
			addBooksToCustomer(db, customer1.id, [book1.isbn, book2.isbn, rogueBook.isbn]);

			// There should be two possible supplier order...
			const result = await getPossibleSupplierOrders(db);
			expect(result.length).toBe(3);

			const [supplierOrder1, generalOrder, supplierOrder2] = result;
			// They should be ordered:
			// Supplier1 name = "Alphabet ...",
			expect(supplierOrder1.supplier_name).toBe(supplier1.name);
			// The default "General" supplier
			expect(generalOrder.supplier_name).toBe(DEFAULT_SUPPLIER_NAME);
			// Suplier2 name = "Xanax ..."
			expect(supplierOrder2.supplier_name).toBe(supplier2.name);
		});

		it("should return an empty list when there are no customer order lines for that supplier", async () => {
			// Associate the books with suppliers...
			await associatePublisher(db, supplier1.id, book1.publisher);
			await associatePublisher(db, supplier2.id, book2.publisher);

			// But don't add any books to a customer order
			const result = await getPossibleSupplierOrders(db);
			expect(result).toEqual([]);
		});

		it("should only aggregate customer order lines that have not been placed", async () => {
			// Associate the books with a suppliers
			const { id: supplierId } = supplier1;
			await associatePublisher(db, supplierId, book1.publisher);
			await associatePublisher(db, supplierId, book2.publisher);

			// Add two books
			// book1 will not have any status timestamps
			addBooksToCustomer(db, customer1.id, [book1.isbn]);
			// book2 will have a placed timestamp
			await db.exec(
				`INSERT INTO customer_order_lines (customer_id, isbn, placed)
				VALUES ($customerId, $isbn, $placed)`,
				[customer1.id, book2.isbn, new Date().getTime()]
			);

			// Only book1 should be included
			const [newSupplierOrder] = await getPossibleSupplierOrders(db);
			expect(newSupplierOrder.total_book_number).toBe(1);
			expect(newSupplierOrder.total_book_price).toBe(book1.price);
		});

		it("should handle missing book prices", async () => {
			// Associate book1 with supplier1
			await associatePublisher(db, supplier1.id, book1.publisher);

			// Associate an isbn without book data to both suppliers
			const rogueBook = { isbn: "666", publisher: "Devil business" };
			await upsertBook(db, rogueBook);

			await associatePublisher(db, supplier1.id, rogueBook.publisher);
			await associatePublisher(db, supplier2.id, rogueBook.publisher);

			// Add all the books to the customer order
			addBooksToCustomer(db, customer1.id, [book1.isbn, rogueBook.isbn]);

			const [newSupplierOrder1, newSupplierOrder2] = await getPossibleSupplierOrders(db);
			// Supplier1 order should = book1.price + 0
			// TODO: is this desirable?
			expect(newSupplierOrder1.supplier_name).toBe(supplier1.name);
			expect(newSupplierOrder1.total_book_price).toBe(book1.price);

			// Supplier2 order should be 0
			expect(newSupplierOrder2.total_book_price).toBe(0);
		});
	});

	describe("getPossibleSupplierOrderLInes should", () => {
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
	});
});

describe("create supplier order should", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
	});

	it("place a new order with possible order lines", async () => {
		const possibleOrderLines = await getPossibleSupplierOrderLines(db, 1);

		await createSupplierOrder(db, possibleOrderLines);

		const newOrders = await getPlacedSupplierOrders(db);

		expect(newOrders.length).toBe(1);

		const newPossibleOrderLines = await getPossibleSupplierOrderLines(db, 1);
		expect(newPossibleOrderLines.length).toBe(0);
	});
});

describe("placed supplier orders:", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
	});

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
