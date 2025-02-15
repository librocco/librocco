import { describe, expect, it } from "vitest";

import { getDB, initializeDB } from "../db";
import { getRandomDb, syncDBs } from "./lib";
import type { Customer } from "../types";
import { getCustomerOrderList, upsertCustomer } from "../customers";

describe("Db creation tests", () => {
	it("should allow initializing a database", async () => {
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		const db = await getDB("init-db-test" + randomTestRunId);
		await expect(db.exec("SELECT schema_name, schema_version FROM crsql_master")).rejects.toThrow();
		await initializeDB(db);
		expect(await db.execA("SELECT key, value FROM crsql_master")).toEqual(
			expect.arrayContaining([
				["schema_name", expect.any(String)],
				["schema_version", expect.any(BigInt)]
			])
		);
	});
});

// NOTE: This is the sync test, using customer orders to sync
// TODO: We should probably: either make this generic (some explicit tables) or test all aspects (tables) of the db
describe("Customer order tests", () => {
	it("Should sync customer creation", async () => {
		const [db1, db2] = await Promise.all([getRandomDb(), getRandomDb()]);

		// We create one customer in db1 and a different one in db2
		let db1Customers: Customer[], db2Customers: Customer[];
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2, displayId: "1" });
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 2, displayId: "2" });
		[db1Customers, db2Customers] = await Promise.all([getCustomerOrderList(db1), getCustomerOrderList(db2)]);
		expect(db1Customers.length).toBe(1);
		expect(db2Customers.length).toBe(1);

		// This tests for a regression we had: we want to ensure that the sync won't update the `updated_at` field
		// - it should be the same as for the original entry
		await new Promise((resolve) => setTimeout(resolve, 1000));

		await syncDBs(db1, db2);
		expect((await getCustomerOrderList(db2)).length).toBe(2);
		await syncDBs(db2, db1);

		expect((await getCustomerOrderList(db1)).length).toBe(2);
		[db1Customers, db2Customers] = await Promise.all([getCustomerOrderList(db1), getCustomerOrderList(db2)]);
		expect(db1Customers).toMatchObject(db2Customers);
	});

	it("Should keep both updates done at the same time on different dbs", async () => {
		const [db1, db2] = await Promise.all([getRandomDb(), getRandomDb()]);

		// We create one customer in db1 and a different one in db2
		await upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2, displayId: "1" });
		await syncDBs(db1, db2);
		await upsertCustomer(db2, { fullname: "Jane Doe", id: 1, email: "jane@example.com", displayId: "1" });
		await syncDBs(db2, db1);
		const [db1Customers, db2Customers] = await Promise.all([getCustomerOrderList(db1), getCustomerOrderList(db2)]);
		expect(db1Customers).toMatchObject(db2Customers);
		expect(db1Customers).toMatchObject([{ fullname: "Jane Doe", id: 1, email: "jane@example.com", deposit: 13.2 }]);
	});
});
