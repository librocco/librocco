import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getDB, initializeDB, getChanges, applyChanges, getSiteId, getPeerDBVersion } from "../db";

import { getAllCustomers, upsertCustomer, getCustomerBooks, addBooksToCustomer, removeBooksFromCustomer } from "../customers";
import type { Customer } from "../customers";

describe("Db creation tests", () => {
	it("should allow initializing a database", async () => {
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		const db = await getDB("init-db-test" + randomTestRunId);
		await expect(getAllCustomers(db)).rejects.toThrow();
		initializeDB(db);
		expect((await getAllCustomers(db)).length).toBe(0);
	});
});

describe("Customer order tests", () => {
	let db: DB;
	// Each test run will use a different db
	// birthday paradox chance of collision for 1k runs is 0.5%)
	let randomTestRunId: number;

	beforeEach(async () => {
		randomTestRunId = Math.floor(Math.random() * 100000000);
		db = await getDB("testdb" + randomTestRunId);
		await initializeDB(db);
	});

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
		addBooksToCustomer(db, 1, [
			{ isbn: "9780000000000", quantity: 1 },
			{ isbn: "9780000000000", quantity: 1 }
		]);
		books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(2);
		expect(books[0].id).toBeTypeOf("number");
	});

	it("can add ten books to a customer 100 times and not take more than 100ms", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1 });
		const howMany = 100;
		const startTime = Date.now();
		for (let i = 0; i < howMany; i++) {
			addBooksToCustomer(db, 1, [
				{ isbn: "9780000000000", quantity: 1 },
				{ isbn: "9780000000001", quantity: 3 },
				{ isbn: "9780000000002", quantity: 1 },
				{ isbn: "9780000000003", quantity: 3 },
				{ isbn: "9780000000004", quantity: 1 },
				{ isbn: "9780000000005", quantity: 2 },
				{ isbn: "9780000000006", quantity: 1 },
				{ isbn: "9780000000007", quantity: 1 },
				{ isbn: "9780000000008", quantity: 2 },
				{ isbn: "9780000000009", quantity: 1 }
			]);
		}
		const duration = Date.now() - startTime;
		const books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(10 * howMany);
		expect(duration).toBeLessThanOrEqual(100);
	});

	it("can remove books from a customer order", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1 });
		addBooksToCustomer(db, 1, [
			{ isbn: "9780000000000", quantity: 1 },
			{ isbn: "9780000000000", quantity: 1 }
		]);
		let books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(2);
		removeBooksFromCustomer(db, 1, [books[0].id]);
		books = await getCustomerBooks(db, 1);
		expect(books.length).toBe(1);
	});
});

describe("Customer order tests", () => {
	let db1: DB, db2: DB;
	// Each test run will use a different db
	// birthday paradox chance of collision for 1k runs is 0.5%)
	let randomTestRunId: number;

	beforeEach(async () => {
		randomTestRunId = Math.floor(Math.random() * 100000000);
		db1 = await getDB("testdb1" + randomTestRunId);
		db2 = await getDB("testdb2" + randomTestRunId);
		await initializeDB(db1);
		await initializeDB(db2);
	});
	it("Should sync customer creation", async () => {
		// We create one customer in db1 and a different one in db2
		let db1Customers: Customer[], db2Customers: Customer[];
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 2 });
		[db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers.length).toBe(1);
		expect(db2Customers.length).toBe(1);
		syncDBs(db1, db2);
		expect((await getAllCustomers(db2)).length).toBe(2);
		syncDBs(db2, db1);
		expect((await getAllCustomers(db1)).length).toBe(2);
		[db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers).toEqual(db2Customers);
	});
	it.only("Should keep both updates done at the same time on different dbs", async () => {
		// We create one customer in db1 and a different one in db2
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		await syncDBs(db1, db2);
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 1, email: "jane@example.com" });
		await syncDBs(db2, db1);
		const [db1Customers, db2Customers] = await Promise.all([getAllCustomers(db1), getAllCustomers(db2)]);
		expect(db1Customers).toEqual(db2Customers);
		expect(db1Customers).toEqual([{ fullname: "Jane Doe", id: 1, email: "jane@example.com", deposit: 13.2 }]);
	});
});

const syncDBs = async (source: DB, destination: DB) => {
	const sourceDBVersion = await getPeerDBVersion(source, await getSiteId(destination));
	await applyChanges(destination, await getChanges(source, sourceDBVersion));
};
