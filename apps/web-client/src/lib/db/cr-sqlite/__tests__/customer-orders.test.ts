import { describe, it, expect, beforeEach } from "vitest";

import type { DB, Customer } from "../types";

import {
	getAllCustomers,
	upsertCustomer,
	getCustomerOrderLines,
	addBooksToCustomer,
	removeBooksFromCustomer,
	getCustomerDisplayIdSeq,
	isDisplayIdUnique,
	markCustomerOrderLineAsCollected
} from "../customers";

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
		expect(Date.now() - customer.updatedAt.getTime()).toBeLessThan(200);

		// Update
		await upsertCustomer(db, { fullname: "John Doe (updated)", id: 1, displayId: "1" });
		const [customerUpdated] = await getAllCustomers(db);
		expect(Date.now() - customerUpdated.updatedAt.getTime()).toBeLessThan(200);
	});

	it("timestamps customer order lines' 'created' with ms precision", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

		await addBooksToCustomer(db, 1, ["1"]);
		const [orderLine1] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - orderLine1.created.getTime()).toBeLessThan(200);

		await addBooksToCustomer(db, 1, ["2"]);
		const [, orderLine2] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - orderLine2.created.getTime()).toBeLessThan(200);
	});

	it("timestamps customer order lines' 'collected' with ms precision", async () => {
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		await addBooksToCustomer(db, 1, ["1", "2"]);

		const [{ id: line1Id }] = await getCustomerOrderLines(db, 1);
		await markCustomerOrderLineAsCollected(db, line1Id);

		const [line1] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - line1.collected.getTime()).toBeLessThan(200);

		const [{ id: line2Id }] = await getCustomerOrderLines(db, 1);
		await markCustomerOrderLineAsCollected(db, line2Id);

		const [line2] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - line2.collected.getTime()).toBeLessThan(200);
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
