import { describe, it, expect, beforeEach } from "vitest";

import type { DB, Customer } from "../types";

import { getDB, initializeDB } from "../db";

import {
	getAllCustomers,
	upsertCustomer,
	getCustomerBooks,
	// markCustomerOrderAsReceived,
	addBooksToCustomer,
	removeBooksFromCustomer
} from "../customers";
// import { createSupplierOrder, getPossibleSupplierOrderLines } from "../suppliers";
import {
	// createCustomerOrders,
	getRandomDb,
	getRandomDbs,
	syncDBs
} from "./lib";

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

	it("can create and update a customer", async () => {
		await expect(upsertCustomer(db, { fullname: "John Doe" })).rejects.toThrow("Customer must have an id");
		await upsertCustomer(db, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2 });
		let customers = await getAllCustomers(db);
		expect(customers.length).toBe(2);
		expect(customers[0].fullname).toBe("John Doe");
		expect(customers[0].email).toBe("john@example.com");
		await upsertCustomer(db, { fullname: "Jane Doe", id: 2, email: "jane@example.com" });
		expect(customers.length).toBe(2);
		customers = await getAllCustomers(db);
		expect(customers[0].email).toBe("john@example.com");
		expect(customers[1].email).toBe("jane@example.com");
	});

	it("can add books to a customer", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1 });
		let books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(0);

		await addBooksToCustomer(db, 1, [{ isbn: "9780000000000" }, { isbn: "9780000000000" }]);
		books = await getCustomerBooks(db, 1);

		expect(books.length).toBe(2);
		expect(books[0].id).toBeTypeOf("number");
		expect(books[0].created).toBeInstanceOf(Date);
	});

	it("can add ten books to a customer 10 times and not take more than 400ms", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1 });
		const howMany = 10;
		const startTime = Date.now();
		for (let i = 0; i < howMany; i++) {
			await db.tx(async (db) => {
				await addBooksToCustomer(db as DB, 1, [
					{ isbn: "9780000000000" },
					{ isbn: "9780000000001" },
					{ isbn: "9780000000002" },
					{ isbn: "9780000000003" },
					{ isbn: "9780000000004" },
					{ isbn: "9780000000005" },
					{ isbn: "9780000000006" },
					{ isbn: "9780000000007" },
					{ isbn: "9780000000008" },
					{ isbn: "9780000000009" }
				]);
			});
		}
		const duration = Date.now() - startTime;
		const books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(10 * howMany);
		expect(duration).toBeLessThanOrEqual(400);
	});

	it("can remove books from a customer order", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1 });

		await addBooksToCustomer(db, 1, [{ isbn: "9780000000000" }, { isbn: "9780000000000" }]);
		let books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(2);
		removeBooksFromCustomer(db, 1, [books[0].id]);
		books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(1);
	});
});

describe("Customer order tests", () => {
	let db1: DB, db2: DB;
	beforeEach(async () => ([db1, db2] = await getRandomDbs()));
	it("Should sync customer creation", async () => {
		// We create one customer in db1 and a different one in db2
		let db1Customers: Customer[], db2Customers: Customer[];
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 2 });
		[db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers.length).toBe(1);
		expect(db2Customers.length).toBe(1);
		await syncDBs(db1, db2);
		expect((await getAllCustomers(db2)).length).toBe(2);
		await syncDBs(db2, db1);
		expect((await getAllCustomers(db1)).length).toBe(2);
		[db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers).toMatchObject(db2Customers);
	});
	it("Should keep both updates done at the same time on different dbs", async () => {
		// We create one customer in db1 and a different one in db2
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		await syncDBs(db1, db2);
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 1, email: "jane@example.com" });
		await syncDBs(db2, db1);
		const [db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers).toMatchObject(db2Customers);
		expect(db1Customers).toMatchObject([{ fullname: "Jane Doe", id: 1, email: "jane@example.com", deposit: 13.2 }]);
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
