import { describe, it, expect } from "vitest";
import { getDB, initializeDB, getAllCustomers, execAsync } from "../orders";

describe("KISS test suite", () => {
	it("should allow initializing a database", async () => {
		const db = await getDB("testdb");
		await expect(execAsync(db, "SELECT id, fullname, email, deposit FROM customer;")).rejects.toThrow();
		initializeDB(db);
		expect((await getAllCustomers(db)).length).toBe(0);
	});
});
