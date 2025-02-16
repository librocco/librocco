import { describe, it, expect, beforeEach } from "vitest";

import type { DB, Customer } from "../types";

import { getDB, initializeDB } from "../db";

import {
	getAllCustomers,
	upsertCustomer,
	getCustomerOrderLines,
	markCustomerOrderAsCollected,
	addBooksToCustomer,
	removeBooksFromCustomer,
	getCustomerDisplayIdSeq,
	isDisplayIdUnique,
	markCustomerOrderLineAsCollected
} from "../customers";
// import { createSupplierOrder, getPossibleSupplierOrderLines } from "../suppliers";
import { markCustomerOrderAsReceived, getRandomDb, getRandomDbs, syncDBs } from "./lib";
import { associatePublisher, createSupplierOrder, getPlacedSupplierOrders, upsertSupplier } from "../suppliers";
import { upsertBook } from "../books";
import { addOrderLinesToReconciliationOrder, createReconciliationOrder, finalizeReconciliationOrder } from "../order-reconciliation";

describe("Db creation tests", () => {
	it("should allow initializing a database", async () => {
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		const db = await getDB("init-db-test" + randomTestRunId);
		await expect(getAllCustomers(db)).rejects.toThrow();
		await initializeDB(db);
		expect((await getAllCustomers(db)).length).toBe(0);
	});
});

describe("Customer order tests", () => {
	let db: DB;
	beforeEach(async () => (db = await getRandomDb()));

	it("throws if no customer id provided", async () => {
		await expect(upsertCustomer(db, { fullname: "John Doe" } as Customer)).rejects.toThrow("Customer must have an id");
	});

	it("throws if no display id provided", async () => {
		await expect(upsertCustomer(db, { id: 1, fullname: "John Doe" } as Customer)).rejects.toThrow("Customer must have a displayId");
	});

	it("can create and update a customer", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2, displayId: "1" });
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "2" });
		let customers = await getAllCustomers(db);
		expect(customers.length).toBe(2);
		expect(customers[0].fullname).toBe("John Doe");
		expect(customers[0].email).toBe("john@example.com");
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2, email: "jane@example.com", displayId: "2" });
		expect(customers.length).toBe(2);
		customers = await getAllCustomers(db);
		expect(customers[0].email).toBe("john@example.com");
		expect(customers[1].email).toBe("jane@example.com");
	});

	it("can add books to a customer", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

		const initialBooks = await getCustomerOrderLines(db, 1);

		expect(initialBooks.length).toBe(0);

		await addBooksToCustomer(db, 1, ["9780000000000", "9title780000000000"]);

		const newBooks = await getCustomerOrderLines(db, 1);

		expect(newBooks.length).toBe(2);

		const [book1] = newBooks;

		// Each order line should have an auto-generated Id
		expect(book1.id).toBeTypeOf("number");
		// Numeric dates of each order line should be marshalled to Date objects
		expect(book1.created).toBeInstanceOf(Date);
		// If date column is not populated (these orders have not been placed) it should be undefined
		expect(book1.placed).toBe(undefined);

		// A subset of book data that is displayed in the Customer Orders table should be returned
		// and coalesced to defaults if a corresponding book entry is not joined by isbn (isbn's added above are not in randomDb)
		expect(book1.title).toBe("N/A");
		expect(book1.price).toBe(0);
		expect(book1.authors).toBe("N/A");
	});

	// NOTE: This shouldn't be taken as a gospel:
	// - if it fails, by a small margin - think about the changes you've introduced that might be causing it, and extend the time limit
	// - if it fails by a large margin, really think about the changes introduced :)
	it("can add ten books to a customer 10 times and not take more than 600ms", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		const howMany = 10;
		const startTime = Date.now();
		for (let i = 0; i < howMany; i++) {
			await db.tx(async (db) => {
				await addBooksToCustomer(db as DB, 1, [
					"9780000000000",
					"9780000000001",
					"9780000000002",
					"9780000000003",
					"9780000000004",
					"9780000000005",
					"9780000000006",
					"9780000000007",
					"9780000000008",
					"9780000000009"
				]);
			});
		}
		const duration = Date.now() - startTime;
		const books = await getCustomerOrderLines(db, 1);
		expect(books.length).toBe(10 * howMany);
		expect(duration).toBeLessThanOrEqual(600);
	});

	it("can remove books from a customer order", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

		await addBooksToCustomer(db, 1, ["9780000000000", "9780000000000"]);
		let books = await getCustomerOrderLines(db, 1);
		expect(books.length).toBe(2);
		await removeBooksFromCustomer(db, 1, [books[0].id]);
		books = await getCustomerOrderLines(db, 1);
		expect(books.length).toBe(1);
	});

	it("timestamps updates with ms precision", async () => {
		// Insert (initial)
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		const [customer] = await getAllCustomers(db);
		expect(Date.now() - customer.updatedAt.getTime()).toBeLessThan(300);

		// Update
		await upsertCustomer(db, { fullname: "John Doe (updated)", id: 1, displayId: "1" });
		const [customerUpdated] = await getAllCustomers(db);
		expect(Date.now() - customerUpdated.updatedAt.getTime()).toBeLessThan(300);
	});

	it("timestamps customer order lines' 'created' with ms precision", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

		await addBooksToCustomer(db, 1, ["1"]);
		const [orderLine1] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - orderLine1.created.getTime()).toBeLessThan(300);

		await addBooksToCustomer(db, 1, ["2"]);
		const [, orderLine2] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - orderLine2.created.getTime()).toBeLessThan(300);
	});

	it("timestamps customer order lines' 'collected' with ms precision", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		await addBooksToCustomer(db, 1, ["1", "2"]);

		const [{ id: line1Id }] = await getCustomerOrderLines(db, 1);
		await markCustomerOrderLineAsCollected(db, line1Id);

		const [line1] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - line1.collected.getTime()).toBeLessThan(300);

		const [{ id: line2Id }] = await getCustomerOrderLines(db, 1);
		await markCustomerOrderLineAsCollected(db, line2Id);

		const [line2] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - line2.collected.getTime()).toBeLessThan(300);
	});
});

describe("Customer order tests", () => {
	let db1: DB, db2: DB;

	beforeEach(async () => ([db1, db2] = await getRandomDbs()));

	it("Should sync customer creation", async () => {
		// We create one customer in db1 and a different one in db2
		let db1Customers: Customer[], db2Customers: Customer[];
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2, displayId: "1" });
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 2, displayId: "2" });
		[db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers.length).toBe(1);
		expect(db2Customers.length).toBe(1);

		// This tests for a regression we had: we want to ensure that the sync won't update the `updated_at` field
		// - it should be the same as for the original entry
		await new Promise((resolve) => setTimeout(resolve, 1000));

		await syncDBs(db1, db2);
		expect((await getAllCustomers(db2)).length).toBe(2);
		await syncDBs(db2, db1);

		expect((await getAllCustomers(db1)).length).toBe(2);
		[db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers).toMatchObject(db2Customers);
	});

	it("Should keep both updates done at the same time on different dbs", async () => {
		// We create one customer in db1 and a different one in db2
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2, displayId: "1" });
		await syncDBs(db1, db2);
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 1, email: "jane@example.com", displayId: "1" });
		await syncDBs(db2, db1);
		const [db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers).toMatchObject(db2Customers);
		expect(db1Customers).toMatchObject([{ fullname: "Jane Doe", id: 1, email: "jane@example.com", deposit: 13.2 }]);
	});
});

describe("Customer order Collection", () => {
	let db: DB;

	beforeEach(async () => (db = await getRandomDb()));

	it("should mark received order lines as collected", async () => {
		await addBooksToCustomer(db, 1, ["9780000000001", "9780000000001"]);
		await upsertBook(db, { isbn: "9780000000001", publisher: "pub1", title: "title1", authors: "author1", price: 10 });
		await upsertSupplier(db, { id: 1 });
		await associatePublisher(db, 1, "pub1");

		await createSupplierOrder(db, 1, [{ isbn: "9780000000001", quantity: 2, supplier_id: 1 }]);

		const placedSupplierOrders = await getPlacedSupplierOrders(db);
		const placedOrderLineIds = placedSupplierOrders.map((order) => order.id);

		const customerOrderLines = await getCustomerOrderLines(db, 1);
		const customerOrderLineIds = customerOrderLines.map((order) => order.id);

		// Mark the books as received
		// await markCustomerOrderAsReceived(db, orderLineIds);
		await createReconciliationOrder(db, 1, placedOrderLineIds);
		await addOrderLinesToReconciliationOrder(db, 1, [
			{ isbn: "9780000000001", quantity: 1 },
			{ isbn: "9780000000001", quantity: 1 }
		]);
		await finalizeReconciliationOrder(db, 1);

		// Mark as collected
		await markCustomerOrderAsCollected(db, customerOrderLineIds);

		const updatedLines = await getCustomerOrderLines(db, 1);

		expect(updatedLines[0].collected).toBeInstanceOf(Date);
		expect(updatedLines[1].collected).toBeInstanceOf(Date);
	});
	it("should mark received order lines as collected", async () => {
		await addBooksToCustomer(db, 1, ["9780000000001", "9780000000001"]);
		await upsertBook(db, { isbn: "9780000000001", publisher: "pub1", title: "title1", authors: "author1", price: 10 });
		await upsertSupplier(db, { id: 1 });
		await associatePublisher(db, 1, "pub1");

		await createSupplierOrder(db, 1, [{ isbn: "9780000000001", quantity: 2, supplier_id: 1 }]);

		const customerOrderLines = await getCustomerOrderLines(db, 1);
		const orderLineIds = customerOrderLines.map((order) => order.id);

		// Mark the books as received
		await markCustomerOrderAsReceived(db, orderLineIds);

		// Mark as collected
		await markCustomerOrderAsCollected(db, orderLineIds);

		const updatedLines = await getCustomerOrderLines(db, 1);

		expect(updatedLines[0].collected).toBeInstanceOf(Date);
		expect(updatedLines[1].collected).toBeInstanceOf(Date);
	});

	it("should allow collecting specific customer orders when multiple customers order the same book", async () => {
		// Create two customers
		await upsertCustomer(db, { fullname: "Customer 1", id: 1, displayId: "1" });
		await upsertCustomer(db, { fullname: "Customer 2", id: 2, displayId: "2" });

		// Both customers order the same book
		await addBooksToCustomer(db, 1, ["9780000000001"]);
		await addBooksToCustomer(db, 2, ["9780000000001"]);

		// Set up book and supplier
		await upsertBook(db, {
			isbn: "9780000000001",
			publisher: "pub1",
			title: "title1",
			authors: "author1",
			price: 10
		});
		await upsertSupplier(db, { id: 1 });
		await associatePublisher(db, 1, "pub1");

		// Order books from supplier
		await createSupplierOrder(db, 1, [
			{
				isbn: "9780000000001",
				quantity: 2, // Order enough for both customers
				supplier_id: 1
			}
		]);

		// Get order lines for both customers
		const customer1OrderLines = await getCustomerOrderLines(db, 1);
		const customer2OrderLines = await getCustomerOrderLines(db, 2);

		// Mark both orders as received
		await markCustomerOrderAsReceived(db, [customer1OrderLines[0].id, customer2OrderLines[0].id]);

		// Only mark customer 2's order as collected
		await markCustomerOrderAsCollected(db, [customer2OrderLines[0].id]);

		// Verify final state
		const finalCustomer1Lines = await getCustomerOrderLines(db, 1);
		const finalCustomer2Lines = await getCustomerOrderLines(db, 2);

		// Customer 1's order should be received but not collected
		expect(finalCustomer1Lines[0].received).toBeInstanceOf(Date);
		expect(finalCustomer1Lines[0].collected).toBeUndefined();

		// Customer 2's order should be both received and collected
		expect(finalCustomer2Lines[0].received).toBeInstanceOf(Date);
		expect(finalCustomer2Lines[0].collected).toBeInstanceOf(Date);
	});

	it("should only mark as collected if book is placed and received", async () => {
		await addBooksToCustomer(db, 1, ["9780000000001"]);

		const customerOrderLines = await getCustomerOrderLines(db, 1);
		const orderLineIds = customerOrderLines.map((order) => order.id);
		// Try to mark as collected without placing/receiving first
		await markCustomerOrderAsCollected(db, orderLineIds);

		const lines = await getCustomerOrderLines(db, 1);
		// Should not be marked as collected
		expect(lines[0].collected).toBeUndefined();
	});

	it("should not affect books that are already collected", async () => {
		await addBooksToCustomer(db, 1, ["9780000000001"]);

		const customerOrderLines = await getCustomerOrderLines(db, 1);
		const orderLineIds = customerOrderLines.map((order) => order.id);
		// Mark as received
		await markCustomerOrderAsReceived(db, orderLineIds);

		// Mark as collected first time
		await markCustomerOrderAsCollected(db, orderLineIds);
		const firstUpdate = await getCustomerOrderLines(db, 1);
		const firstCollectedDate = firstUpdate[0].collected;

		// Wait a moment to ensure timestamps would be different
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Try to mark as collected again
		await markCustomerOrderAsCollected(db, orderLineIds);
		const secondUpdate = await getCustomerOrderLines(db, 1);

		// Collection date should not have changed
		expect(secondUpdate[0].collected).toEqual(firstCollectedDate);
	});
});

describe("Customer display id seq", () => {
	it("returns 1 when there are no customer orders in the DB", async () => {
		const db = await getRandomDb();
		const displayId = await getCustomerDisplayIdSeq(db);
		expect(displayId).toBe(1);
	});

	it("returns n + 1 when there are customers in the DB", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

		const displayId = await getCustomerDisplayIdSeq(db);
		expect(displayId).toBe(2);
	});

	it("returns n + 1 when there are customers in the DB, even when there are spaces between seq", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "3" });

		const displayId = await getCustomerDisplayIdSeq(db);
		expect(displayId).toBe(4);
	});

	it("returns n + 1 ignoring n > 10k", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "10000" });
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "3" });

		const displayId = await getCustomerDisplayIdSeq(db);
		expect(displayId).toBe(4);
	});

	it("can cope with invalid displayIds", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "invalid" });
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "3" });

		const displayId = await getCustomerDisplayIdSeq(db);
		expect(displayId).toBe(4);
	});
});

describe("isDisplayIdUnique function", () => {
	it("returns true if unique", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		expect(await isDisplayIdUnique(db, { id: 1, displayId: "2" })).toEqual(true);
	});

	it("returns false if one or more entries have the same value", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "1" });
		await upsertCustomer(db, { fullname: "James Doe", id: 3, displayId: "3" });
		expect(await isDisplayIdUnique(db, { id: 3, displayId: "1" })).toEqual(false);
	});

	it("edge case: returns true if the only entry with the same value is the exact one comparing", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		expect(await isDisplayIdUnique(db, { id: 1, displayId: "1" })).toEqual(true);
	});
});

// TODO: update this when we have a handler to getPlacedOrderLines
// describe("Customer order status", () => {
// 	let db: DB;
// 	beforeEach(async () => {
// 		db = await getRandomDb();
// 		await createCustomerOrders(db);
// 	});
// 	it("can update the timestamp of when a customer order is placed (to supplier)", async () => {
// 		const newOrderLines = await getPossibleSupplierOrderLines(db, 1);

// 		await createSupplierOrder(db, newOrderLines);

// 	const isbns = [...newOrders[0].lines, ...newOrders[1].lines].map((line) => line.isbn);
// 	await markCustomerOrderAsReceived(db, isbns);
// 	const books = await getCustomerBooks(db, 1);
// 	expect(books[1].received).toBeInstanceOf(Date);
// 	});
// });
