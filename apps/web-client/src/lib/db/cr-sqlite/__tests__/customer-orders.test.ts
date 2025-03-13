import { describe, it, expect } from "vitest";

import { type DB, type Customer, OrderLineStatus } from "../types";

import { getRandomDb } from "./lib";

import {
	upsertCustomer,
	getCustomerOrderLines,
	markCustomerOrderLinesAsCollected,
	addBooksToCustomer,
	removeBooksFromCustomer,
	getCustomerDisplayIdSeq,
	isDisplayIdUnique,
	getCustomerDetails,
	getCustomerOrderList
} from "../customers";

import { upsertBook } from "../books";

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
			expect(Date.now() - customer.updatedAt.getTime()).toBeLessThan(300);

			const oldUpdatedAt = customer.updatedAt;
			await upsertCustomer(db, { fullname: "John Doe (Updated)", id: 1, displayId: "1" });
			customer = await getCustomerDetails(db, 1);

			expect(Date.now() - customer.updatedAt.getTime()).toBeLessThan(300);
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

describe("Customer order lines", () => {
	describe("addBooksToCustomer should", () => {
		it("add books to a customer order (in pending state as default)", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });

			await addBooksToCustomer(db, 1, ["9780000000000", "9title780000000000"]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({
					id: expect.any(Number),
					isbn: "9780000000000",
					created: expect.any(Date),
					placed: undefined,
					received: undefined,
					collected: undefined
				}),
				expect.objectContaining({
					id: expect.any(Number),
					isbn: "9title780000000000",
					created: expect.any(Date),
					placed: undefined,
					received: undefined,
					collected: undefined
				})
			]);
		});

		it("add two lines with the same isbn if multiple instances of isbn are added", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });

			await addBooksToCustomer(db, 1, ["1", "1"]);

			const orderLines = await getCustomerOrderLines(db, 1);
			expect(orderLines).toEqual([expect.objectContaining({ isbn: "1" }), expect.objectContaining({ isbn: "1" })]);
			expect(orderLines[0].id).not.toEqual(orderLines[1].id);
		});

		it("timestamp customer order lines' 'created' with ms precision", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

			await addBooksToCustomer(db, 1, ["1"]);
			const [orderLine1] = await getCustomerOrderLines(db, 1);
			expect(Date.now() - orderLine1.created.getTime()).toBeLessThan(300);

			await addBooksToCustomer(db, 1, ["2"]);
			const [, orderLine2] = await getCustomerOrderLines(db, 1);
			expect(Date.now() - orderLine2.created.getTime()).toBeLessThan(300);
		});

		it("timestamp respective customer's 'updated_at' with ms precision each time a line is added", async () => {
			const db = await getRandomDb();
			let customer: Customer;

			await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });

			await addBooksToCustomer(db, 1, ["1"]);
			customer = await getCustomerDetails(db, 1);
			expect(Date.now() - customer.updatedAt.getTime()).toBeLessThan(300);

			const oldUpdatedAt = customer.updatedAt;
			await addBooksToCustomer(db, 1, ["2"]);
			customer = await getCustomerDetails(db, 1);

			expect(Date.now() - customer.updatedAt.getTime()).toBeLessThan(300);
			expect(customer.updatedAt > oldUpdatedAt).toBe(true);
		});
	});

	describe("removeBooksFromCustomer should", () => {
		it("remove a book from customer order", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2", "3"]);

			const [, line2] = await getCustomerOrderLines(db, 1);
			await removeBooksFromCustomer(db, 1, [line2.id]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1" }),
				expect.objectContaining({ id: expect.any(Number), isbn: "3" })
			]);
		});

		it("remove multiple books from customer order", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2", "3"]);

			const [line1, line2] = await getCustomerOrderLines(db, 1);
			await removeBooksFromCustomer(db, 1, [line1.id, line2.id]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ id: expect.any(Number), isbn: "3" })]);
		});

		it("timestamp customer's 'updated_at' with ms precision each time a line is removed", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2", "3"]);
			const { updatedAt: oldUpdatedAt } = await getCustomerDetails(db, 1);

			const [line1] = await getCustomerOrderLines(db, 1);
			await removeBooksFromCustomer(db, 1, [line1.id]);

			const { updatedAt } = await getCustomerDetails(db, 1);
			expect(Date.now() - updatedAt.getTime()).toBeLessThan(300);
			expect(updatedAt > oldUpdatedAt).toBe(true);
		});
	});

	describe("markCustomerOrderLinesAsCollected should", () => {
		it("mark received order lines as collected", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "2"]);

			const [{ id: l1 }, { id: l2 }] = await getCustomerOrderLines(db, 1);

			await markCustomerOrderLinesAsCollected(db, [l1, l2]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ collected: expect.any(Date) }),
				expect.objectContaining({ collected: expect.any(Date) })
			]);
		});

		it("mark only the required lines (not the whole order)", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "2", "3"]);

			const [{ id: l1 }, { id: l2 }] = await getCustomerOrderLines(db, 1);

			await markCustomerOrderLinesAsCollected(db, [l1, l2]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ collected: expect.any(Date) }),
				expect.objectContaining({ collected: expect.any(Date) }),
				expect.objectContaining({ collected: undefined })
			]);
		});

		it("not confuse the lines with the same ISBN", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "1", "1"]);

			const [{ id: l1 }, { id: l2 }] = await getCustomerOrderLines(db, 1);

			await markCustomerOrderLinesAsCollected(db, [l1, l2]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ collected: expect.any(Date) }),
				expect.objectContaining({ collected: expect.any(Date) }),
				expect.objectContaining({ collected: undefined })
			]);
		});

		it("not interfere with other customer orders", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1"]);
			await addBooksToCustomer(db, 2, ["1"]);

			const [{ id: l1 }] = await getCustomerOrderLines(db, 1);

			await markCustomerOrderLinesAsCollected(db, [l1]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ collected: expect.any(Date) })]);
			expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ collected: undefined })]);
		});

		it("timestamp customer order lines' 'collected' with ms precision", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "2"]);

			const [{ id: l1 }] = await getCustomerOrderLines(db, 1);
			await markCustomerOrderLinesAsCollected(db, [l1]);

			const [line1] = await getCustomerOrderLines(db, 1);
			expect(Date.now() - line1.collected.getTime()).toBeLessThan(300);

			const [{ id: l2 }] = await getCustomerOrderLines(db, 1);
			await markCustomerOrderLinesAsCollected(db, [l2]);

			const [line2] = await getCustomerOrderLines(db, 1);
			expect(Date.now() - line2.collected.getTime()).toBeLessThan(300);
		});
	});

	describe("getCustomerOrderLines should", () => {
		it("retrieve a list of order lines for the customer", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2"]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1" }),
				expect.objectContaining({ id: expect.any(Number), isbn: "2" })
			]);
		});

		it("not confuse lines belonging to different customer orders", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2"]);

			await upsertCustomer(db, { id: 2, displayId: "2" });
			await addBooksToCustomer(db, 2, ["3", "4"]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1" }),
				expect.objectContaining({ id: expect.any(Number), isbn: "2" })
			]);

			expect(await getCustomerOrderLines(db, 2)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "3" }),
				expect.objectContaining({ id: expect.any(Number), isbn: "4" })
			]);
		});

		it("retrieve book data (if available) for a particular line", async () => {
			const db = await getRandomDb();

			await upsertBook(db, { isbn: "1", title: "Book 1", authors: "Author 1", price: 10 });

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1"]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				{
					id: expect.any(Number),
					isbn: "1",
					title: "Book 1",
					authors: "Author 1",
					category: "",
					editedBy: "",
					outOfPrint: 0,
					publisher: "",
					year: "",
					price: 10,
					created: expect.any(Date),
					placed: undefined,
					received: undefined,
					collected: undefined,
					customer_id: expect.any(Number),
					status: expect.any(Number)
				}
			]);
		});

		it("coalesce unavailable book data (to default values) for customer lines", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1"]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				{
					id: expect.any(Number),
					isbn: "1",
					title: "N/A",
					authors: "N/A",
					category: "",
					editedBy: "",
					outOfPrint: 0,
					publisher: "",
					year: "",
					price: 0,
					created: expect.any(Date),
					placed: undefined,
					received: undefined,
					collected: undefined,
					customer_id: expect.any(Number),
					status: expect.any(Number)
				}
			]);
		});

		it("correctly infer order line state", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });

			// Add one line to customer order - pending
			await addBooksToCustomer(db, 1, ["1"]);
			expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", status: OrderLineStatus.Draft })]);

			// Order the line with the supplier - placed
			await db.exec("UPDATE customer_order_lines SET placed = ? WHERE customer_id = 1", [Date.now()]);
			expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", status: OrderLineStatus.Placed })]);

			// Reconcile the order line - received
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE customer_id = 1", [Date.now()]);
			expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", status: OrderLineStatus.Received })]);

			// Mark the line as collected - collected
			await db.exec("UPDATE customer_order_lines SET collected = ? WHERE customer_id = 1", [Date.now()]);
			expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", status: OrderLineStatus.Collected })]);
		});

		it("consider order line received even if not placed (edge case: in case of overdelivery of previous order)", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });

			await addBooksToCustomer(db, 1, ["1"]);
			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1", status: OrderLineStatus.Draft })
			]);
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE customer_id = 1", [Date.now()]);
		});

		it("not confuse states for different order lines", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2", "3"]);
			const [line1, line2] = await getCustomerOrderLines(db, 1);

			// Mark line 1 as placed and line 2 as received (line 3 is pending)
			await db.exec("UPDATE customer_order_lines SET placed = ? WHERE id = ?", [Date.now(), line1.id]);
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE id = ?", [Date.now(), line2.id]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1", status: OrderLineStatus.Placed }),
				expect.objectContaining({ id: expect.any(Number), isbn: "2", status: OrderLineStatus.Received }),
				expect.objectContaining({ id: expect.any(Number), isbn: "3", status: OrderLineStatus.Draft })
			]);
		});

		it("not confuse states for order lines with same isbn (different customer)", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1"]);

			await upsertCustomer(db, { id: 2, displayId: "2" });
			await addBooksToCustomer(db, 2, ["1"]);

			const [c1line] = await getCustomerOrderLines(db, 1);
			const [c2line] = await getCustomerOrderLines(db, 2);

			// Mark customer 1 line as placed and customer 2 line as received
			await db.exec("UPDATE customer_order_lines SET placed = ? WHERE id = ?", [Date.now(), c1line.id]);
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE id = ?", [Date.now(), c2line.id]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1", status: OrderLineStatus.Placed })
			]);
			expect(await getCustomerOrderLines(db, 2)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1", status: OrderLineStatus.Received })
			]);
		});

		it("not confuse states for order lines with same isbn (same customer)", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "1"]);
			const [line1, line2] = await getCustomerOrderLines(db, 1);

			// Mark line 1 as placed and line 2 as received (line 3 is pending)
			await db.exec("UPDATE customer_order_lines SET placed = ? WHERE id = ?", [Date.now(), line1.id]);
			await db.exec("UPDATE customer_order_lines SET received = ? WHERE id = ?", [Date.now(), line2.id]);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ id: expect.any(Number), isbn: "1", status: OrderLineStatus.Placed }),
				expect.objectContaining({ id: expect.any(Number), isbn: "1", status: OrderLineStatus.Received })
			]);
		});
	});
});

// NOTE: This shouldn't be taken as a gospel:
// - if it fails, by a small margin - think about the changes you've introduced that might be causing it, and extend the time limit
// - if it fails by a large margin, really think about the changes introduced :)
describe("Stress tests", () => {
	it("can add ten books to a customer 10 times and not take more than 800ms", async () => {
		const db = await getRandomDb();
		await upsertCustomer(db, { fullname: "John Doe", id: 1, displayId: "1" });
		const howMany = 10;
		const startTime = Date.now();
		for (let i = 0; i < howMany; i++) {
			// NOTE: this was wrapped in a transaction, but 'addBooksToCustomer'
			// already runs inside a transaction (internally)
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
		}
		const duration = Date.now() - startTime;
		const books = await getCustomerOrderLines(db, 1);
		expect(books.length).toBe(10 * howMany);
		expect(duration).toBeLessThanOrEqual(800);
	});
});
