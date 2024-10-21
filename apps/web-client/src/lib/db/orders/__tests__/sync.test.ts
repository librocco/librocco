import { describe, it, expect } from "vitest";

import { upsertCustomer, getAllCustomers } from "../customers-remote";

describe("Remote db setup", () => {
	it("upserts customer(s)", async () => {
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		const dbName = `test-${randomTestRunId}`

		// Insert the customer
		await upsertCustomer(dbName, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		expect(await getAllCustomers(dbName)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }])

		// Try the update
		await upsertCustomer(dbName, { fullname: "John Doe Updated", id: 1, email: "john@example.com", deposit: 13.2 });
		expect(await getAllCustomers(dbName)).toEqual([{ fullname: "John Doe Updated", id: 1, email: "john@example.com", deposit: 13.2 }])
	});
});
