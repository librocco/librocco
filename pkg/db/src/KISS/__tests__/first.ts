import { describe, it, expect, beforeEach } from "vitest";
import { getDB, initializeDB, getAllCustomers, upsertCustomer } from "../orders";

describe("Customer order tests", () => {
	let db;
	// Each test run will use a different db
	// birthday paradox chance of collision for 1k runs is 0.5%)
	let randomTestRunId;
	beforeEach(async () => {
		randomTestRunId = Math.floor(Math.random() * 100000000);
		db = await getDB("testdb" + randomTestRunId);
		await initializeDB(db);
	});
	it("should allow initializing a database", async () => {
		const db = await getDB("init-db-test" + randomTestRunId);
		await expect(getAllCustomers(db)).rejects.toThrow();
		initializeDB(db);
		expect((await getAllCustomers(db)).length).toBe(0);
	});
	it("can create and update a customer", async () => {
		await expect(upsertCustomer(db, { fullname: "John Doe" })).rejects.toThrow("Customer must have an id");
		upsertCustomer(db, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		upsertCustomer(db, { fullname: "Jane Doe", id: 2 });
		let customers = await getAllCustomers(db);
		expect(customers.length).toBe(2);
		expect(customers[0].fullname).toBe("John Doe");
		expect(customers[0].email).toBe("john@example.com");
		upsertCustomer(db, { fullname: "Jane Doe", id: 2, email: "jane@example.com" });
		expect(customers.length).toBe(2);
		customers = await getAllCustomers(db);
		expect(customers[1].email).toBe("jane@example.com");
	});
});
