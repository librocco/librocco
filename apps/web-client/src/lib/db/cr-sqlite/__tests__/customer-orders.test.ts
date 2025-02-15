import { describe, it, expect, beforeEach } from "vitest";

import type { DB, Customer } from "../types";

import {
	upsertCustomer,
	getCustomerOrderLines,
	addBooksToCustomer,
	removeBooksFromCustomer,
	getCustomerDisplayIdSeq,
	isDisplayIdUnique,
	markCustomerOrderLineAsCollected,
	getCustomerDetails,
	getCustomerOrderList
} from "../customers";

import { getRandomDb } from "./lib";

describe("Customer orders", () => {
	describe("upsertCustomer should", () => {
		it("throw an error if customer id not provided", async () => {
			const db = await getRandomDb();
			await expect(upsertCustomer(db, { fullname: "John Doe" } as Customer)).rejects.toThrow("Customer must have an id");
		});

		it("throw an error if display id not provided", async () => {
			const db = await getRandomDb();
			await expect(upsertCustomer(db, { id: 1, fullname: "John Doe" } as Customer)).rejects.toThrow("Customer must have a displayId");
		});

		it("create a customer order with full fields", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, {
				fullname: "John Doe",
				id: 1,
				email: "john@example.com",
				deposit: 13.2,
				displayId: "1"
			});

			expect(await getCustomerDetails(db, 1)).toEqual({
				fullname: "John Doe",
				id: 1,
				email: "john@example.com",
				deposit: 13.2,
				displayId: "1",
				updatedAt: expect.any(Date)
			});
		});

		it("using minimal fields with expected fallbacks", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, {
				id: 1,
				displayId: "1"
			});

			expect(await getCustomerDetails(db, 1)).toEqual({
				id: 1,
				fullname: "N/A",
				email: null,
				deposit: 0,
				displayId: "1",
				updatedAt: expect.any(Date)
			});
		});

		it("update customer (if already exists)", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

			await upsertCustomer(db, { fullname: "John Doe (Updated)", id: 1, displayId: "1", deposit: 13.2 });
			expect(await getCustomerDetails(db, 1)).toMatchObject({
				id: 1,
				displayId: "1",
				fullname: "John Doe (Updated)",
				deposit: 13.2
			});
		});

		it("timestamp updates with ms precision", async () => {
			const db = await getRandomDb();
			let customer: Customer;

			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
			customer = await getCustomerDetails(db, 1);
			expect(Date.now() - customer.updatedAt.getTime()).toBeLessThanOrEqual(200);

			// Wait for 200ms to ensure we're not within 200ms of the round second
			await new Promise((res) => setTimeout(res, 200));

			const oldUpdatedAt = customer.updatedAt;
			await upsertCustomer(db, { fullname: "John Doe (Updated)", id: 1, displayId: "1" });
			customer = await getCustomerDetails(db, 1);

			expect(Date.now() - customer.updatedAt.getTime()).toBeLessThanOrEqual(200);
			expect(customer.updatedAt > oldUpdatedAt).toBe(true);
		});
	});

	describe("getCustomerDisplayIdSeq should", () => {
		it("return 1 when there are no customer orders in the DB", async () => {
			const db = await getRandomDb();
			const displayId = await getCustomerDisplayIdSeq(db);
			expect(displayId).toBe(1);
		});

		it("return n + 1 when there are customers in the DB", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

			const displayId = await getCustomerDisplayIdSeq(db);
			expect(displayId).toBe(2);
		});

		it("return n + 1 when there are customers in the DB, even when there are spaces between seq", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
			await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "3" });

			const displayId = await getCustomerDisplayIdSeq(db);
			expect(displayId).toBe(4);
		});

		it("return n + 1 ignoring n > 10k", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "10000" });
			await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "3" });

			const displayId = await getCustomerDisplayIdSeq(db);
			expect(displayId).toBe(4);
		});

		it("cope with invalid displayIds", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "invalid" });
			await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "3" });

			const displayId = await getCustomerDisplayIdSeq(db);
			expect(displayId).toBe(4);
		});
	});

	describe("isDisplayIdUnique should", () => {
		it("return true if unique", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
			expect(await isDisplayIdUnique(db, { id: 1, displayId: "2" })).toEqual(true);
		});

		it("return false if one or more entries have the same value", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
			await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "1" });
			await upsertCustomer(db, { fullname: "James Doe", id: 3, displayId: "3" });
			expect(await isDisplayIdUnique(db, { id: 3, displayId: "1" })).toEqual(false);
		});

		it("return true if the only entry with the same value is the exact one comparing", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
			expect(await isDisplayIdUnique(db, { id: 1, displayId: "1" })).toEqual(true);
		});
	});

	describe("getCustomerDetails should", () => {
		it("return undefined if customer not found", async () => {
			const db = await getRandomDb();
			expect(await getCustomerDetails(db, 1)).toBe(undefined);
		});

		// NOTE: thie is a duplicate of upsertCustomer test case (with miminal fields)
		// but is here to stress the point and have an explicit test related COALESCEd fields
		it("coalesce all (optional) fields except for email", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, {
				id: 1,
				displayId: "1"
			});

			expect(await getCustomerDetails(db, 1)).toEqual({
				id: 1,
				fullname: "N/A",
				email: null,
				deposit: 0,
				displayId: "1",
				updatedAt: expect.any(Date)
			});
		});
	});

	describe("getCustomerOrderList should", () => {
		it("retrieve a list of customer orders", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
			await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "2" });

			expect(await getCustomerOrderList(db)).toEqual([
				expect.objectContaining({ id: 1, fullname: "John Doe", displayId: "1" }),
				expect.objectContaining({ id: 2, fullname: "Jane Doe", displayId: "2" })
			]);
		});

		// NOTE: unlike 'getCustomerDetails', which retrieves data for a single customer - and one that will be used within customer form,
		// the customer list gets all optional fields COALESCEd
		it("retrieve fallbacks for all optional fields", async () => {
			const db = await getRandomDb();
			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
			await upsertCustomer(db, { fullname: "Jane Doe", id: 2, displayId: "2" });

			expect(await getCustomerOrderList(db)).toEqual([
				{ id: 1, fullname: "John Doe", displayId: "1", email: "N/A", deposit: 0, updatedAt: expect.any(Date), completed: false },
				{ id: 2, fullname: "Jane Doe", displayId: "2", email: "N/A", deposit: 0, updatedAt: expect.any(Date), completed: false }
			]);
		});

		it("mark an order as completed if all lines are collected", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2"]);

			// Mark the lines as collected
			//
			// NOTE: this is testing for implementation and is brittle with respect to data model updates,
			// but it's a trede-off to not have to include a quite elaborate process of placing supplier orders and reconciling them
			await db.exec("UPDATE customer_order_lines SET collected = ?", [Date.now()]);

			expect(await getCustomerOrderList(db)).toEqual([expect.objectContaining({ id: 1, completed: true })]);
		});

		it("mark an order as in-progress (not completed) if at least one line is not collected", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2"]);
			const [line1, line2] = await getCustomerOrderLines(db, 1);

			// One line collected, other merely received from the supplier
			await db.exec("UPDATE customer_order_lines SET collected = ? WHERE id = ?", [Date.now(), line1.id]);
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE id = ?", [Date.now(), line2.id]);

			expect(await getCustomerOrderList(db)).toEqual([expect.objectContaining({ id: 1, completed: false })]);
		});

		it("mark an order as in-progress (not completed) for including any non-collected lines", async () => {
			const db = await getRandomDb();

			// 1 received line
			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1"]);
			const [c1line] = await getCustomerOrderLines(db, 1);
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE id = ?", [Date.now(), c1line.id]);

			// 1 placed line
			await upsertCustomer(db, { id: 2, displayId: "2" });
			await addBooksToCustomer(db, 2, ["1"]);
			const [c2line] = await getCustomerOrderLines(db, 1);
			await db.exec("UPDATE customer_order_lines SET placed = ? WHERE id = ?", [Date.now(), c2line.id]);

			// 1 pending line
			await upsertCustomer(db, { id: 3, displayId: "3" });
			await addBooksToCustomer(db, 3, ["1"]);

			expect(await getCustomerOrderList(db)).toEqual([
				expect.objectContaining({ id: 1, completed: false }),
				expect.objectContaining({ id: 2, completed: false }),
				expect.objectContaining({ id: 3, completed: false })
			]);
		});

		it("correctly group customer order lines (to their respective customers) when calculating state", async () => {
			const db = await getRandomDb();

			// 1 received line, 1 collected line - in-progress
			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2"]);
			const c1lines = await getCustomerOrderLines(db, 1);
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE id = ?", [Date.now(), c1lines[0].id]);
			await db.exec("UPDATE customer_order_lines SET collected = ? WHERE id = ?", [Date.now(), c1lines[1].id]);

			// 1 collected line - completed
			await upsertCustomer(db, { id: 2, displayId: "2" });
			await addBooksToCustomer(db, 2, ["1"]);
			const [c2line] = await getCustomerOrderLines(db, 2);
			await db.exec("UPDATE customer_order_lines SET collected = ? WHERE id = ?", [Date.now(), c2line.id]);

			// 2 collected lines - completed
			await upsertCustomer(db, { id: 3, displayId: "3" });
			await addBooksToCustomer(db, 3, ["1", "2"]);
			const c3lines = await getCustomerOrderLines(db, 3);
			await db.exec("UPDATE customer_order_lines SET collected = ? WHERE id = ?", [Date.now(), c3lines[0].id]);
			await db.exec("UPDATE customer_order_lines SET collected = ? WHERE id = ?", [Date.now(), c3lines[1].id]);

			// 1 pending line, 1 collected line - in progress
			await upsertCustomer(db, { id: 4, displayId: "3" });
			await addBooksToCustomer(db, 4, ["1", "2"]);
			const [c4line] = await getCustomerOrderLines(db, 4);
			await db.exec("UPDATE customer_order_lines SET collected = ? WHERE id = ?", [Date.now(), c4line.id]);

			expect(await getCustomerOrderList(db)).toEqual([
				expect.objectContaining({ id: 1, completed: false }),
				expect.objectContaining({ id: 2, completed: true }),
				expect.objectContaining({ id: 3, completed: true }),
				expect.objectContaining({ id: 4, completed: false })
			]);
		});
	});
});

describe("Customer order tests", () => {
	let db: DB;
	beforeEach(async () => (db = await getRandomDb()));

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
