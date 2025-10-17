import { expect } from "@playwright/test";

import { appHash, baseURL, remoteDbURL, syncUrl } from "@/constants";

import { testOrders } from "@/helpers/fixtures";
import { getDbHandle } from "@/helpers";

import { getCustomerOrderList, getRemoteDbHandle, upsertCustomer } from "@/helpers/cr-sqlite";

// NOTE: using customer list for sync test...we could also test for other cases, but if sync is working here (and reactivity is there -- different tests)
// the sync should work for other cases all the same
testOrders("should sync client <-> sync server", async ({ page, customers }) => {
	// Start the sync
	await page.evaluate(
		([syncUrl]) => {
			// NOTE: the surrounding double quotes need to be part of the string as the svelte-persisted reads (and stores) the
			// values as JSON objects (and the string including quotes is a valid JSON value)
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl]
	);
	await page.reload();
	await page.goto(baseURL);

	await page.goto(appHash("customers"));

	const table = page.getByRole("table");

	// Get every row in the table: customer rows + head
	const baseRowCount = customers.length + 1;

	const customerRow = table.getByRole("row");

	// Wait for the page to load
	await expect(customerRow).toHaveCount(baseRowCount);

	const dbHandle = await getDbHandle(page);
	const remoteDbHandle = await getRemoteDbHandle(page, remoteDbURL);

	// Create
	//
	// UPDATE A
	await dbHandle.evaluate(upsertCustomer, { id: 4, displayId: "4", fullname: "Customer 4", email: "cus4@email.com" });
	// UPDATE B
	await remoteDbHandle.evaluate(upsertCustomer, { id: 5, displayId: "5", fullname: "Customer 5", email: "cus5@email.com" });
	// Wait for UPDATE B
	await customerRow.filter({ hasText: "Customer 4" }).getByText("cus4@email.com").waitFor();
	await customerRow.filter({ hasText: "Customer 5" }).getByText("cus5@email.com").waitFor();
	// Check for UPDATE A in remote
	let remoteCustomers = await remoteDbHandle.evaluate(getCustomerOrderList);
	// updated_at DESC ordering
	expect(remoteCustomers[0].id).toEqual(5);
	expect(remoteCustomers[0].fullname).toEqual("Customer 5");
	expect(remoteCustomers[1].id).toEqual(4);
	expect(remoteCustomers[1].fullname).toEqual("Customer 4");

	// Update
	//
	// UPDATE A
	await dbHandle.evaluate(upsertCustomer, { id: 5, displayId: "5", fullname: "Customer 5 - updated locally" });
	// UPDATE B
	await remoteDbHandle.evaluate(upsertCustomer, { id: 4, displayId: "4", fullname: "Customer 4 - updated remotely" });
	// Wait for UPDATE B
	await customerRow.filter({ hasText: "Customer 4 - updated remotely" }).getByText("cus4@email.com").waitFor();
	await customerRow.filter({ hasText: "Customer 5 - updated locally" }).getByText("cus5@email.com").waitFor();
	// Check for UPDATE A in remote
	remoteCustomers = await remoteDbHandle.evaluate(getCustomerOrderList);
	// updated_at DESC ordering
	expect(remoteCustomers[0].id).toEqual(4);
	expect(remoteCustomers[0].fullname).toEqual("Customer 4 - updated remotely");
	expect(remoteCustomers[1].id).toEqual(5);
	expect(remoteCustomers[1].fullname).toEqual("Customer 5 - updated locally");
});
