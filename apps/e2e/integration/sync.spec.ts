import { expect } from "@playwright/test";

import { appHash, baseURL, remoteDbURL, syncUrl } from "@/constants";

import { testBase as test, testOrders } from "@/helpers/fixtures";

import { getDbHandle, getCustomerOrderList, getRemoteDbHandle, upsertCustomer, externalExec } from "@/helpers/cr-sqlite";

// NOTE: using customer list for sync test...we could also test for other cases, but if sync is working here (and reactivity is there -- different tests)
// the sync should work for other cases all the same
testOrders("should update UI when remote-only changes arrive via sync", async ({ page, customers }) => {
	// Set up sync
	await page.evaluate(
		([syncUrl]) => {
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl]
	);
	await page.reload();
	await page.goto(baseURL);
	await page.goto(appHash("customers"));

	// Wait for initial load
	const table = page.getByRole("table");
	const baseRowCount = customers.length + 1;
	await expect(table.getByRole("row")).toHaveCount(baseRowCount);

	// Wait for sync to stabilize - ensure we're not catching the initial sync
	await page.waitForTimeout(1000);

	// External database write — simulates an external process (like sqlite3 CLI) modifying the database.
	// This uses a completely separate database connection that bypasses the sync server's internal cache,
	// triggering FSNotify file watching. The bug being tested: fileEventNameToDbId was stripping the
	// .sqlite3 extension, causing a mismatch between how listeners register (with extension) and how
	// file events are converted to dbids (without extension).
	const now = Date.now();
	await externalExec(
		page,
		remoteDbURL,
		`INSERT OR REPLACE INTO customer (id, display_id, fullname, email, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[99, "99", "External Process Customer", "external@test.com", now, now]
	);

	// This must appear without any local interaction
	// Use a short timeout - the UI should update promptly after sync, not after 30s of polling
	// With the bug (extension stripped), this will timeout because FSNotify won't find listeners
	await table.getByRole("row").filter({ hasText: "External Process Customer" }).waitFor({ timeout: 500 });
});

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

test("initial sync optimization should replace local db from remote snapshot", async ({ page }) => {
	const remoteDbHandle = await getRemoteDbHandle(page, remoteDbURL);

	await remoteDbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Remote Customer", email: "remote@example.com" });
	const remoteCustomers = await remoteDbHandle.evaluate(getCustomerOrderList);
	expect(remoteCustomers.some((customer) => customer.id === 1)).toBe(true);

	const dbid = await page.evaluate(() => JSON.parse(window.localStorage.getItem("librocco-current-db") || '""'));
	const fileUrl = `${remoteDbURL}${dbid}/file`;

	await page.evaluate(
		async ({ dbid, fileUrl }) => {
			const w = window as any;
			await w._app.sync.runExclusive((sync: any) =>
				w._performInitialSync(dbid, fileUrl, sync.initialSyncProgressStore, async () => {
					const db = await w._getDb(w._app);
					await db.close();
				})
			);
		},
		{ dbid, fileUrl }
	);

	await page.reload();
	await page.waitForSelector('body[hydrated="true"]', { timeout: 10000 });
	await page.waitForSelector("#app-splash", { state: "detached", timeout: 10000 });

	const refreshedDbHandle = await getDbHandle(page);
	const localCustomers = await refreshedDbHandle.evaluate(getCustomerOrderList);
	expect(localCustomers.some((customer) => customer.id === 1)).toBe(true);
});
