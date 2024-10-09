import { describe, it, expect } from "vitest";
import { getDB, initializeDB, getAllCustomers } from "../orders";

describe("KISS test suite", () => {
	it("should allow initializing a database", async () => {
		const db = await getDB("testdb");
		await expect(getAllCustomers(db)).rejects.toThrow();
		initializeDB(db);
		expect((await getAllCustomers(db)).length).toBe(0);
	});
});
