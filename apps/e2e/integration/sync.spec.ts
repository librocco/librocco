import { expect } from "@playwright/test";

import { appHash, baseURL, remoteDbURL, syncUrl } from "@/constants";

import { testBase as test, testOrders } from "@/helpers/fixtures";

import { getDbHandle, getCustomerOrderList, getRemoteDbHandle, upsertCustomer } from "@/helpers/cr-sqlite";

test.setTimeout(20_000);

const sleep = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

const retry = async <T>(fn: () => Promise<T>, opts: { attempts?: number; delayMs?: number; fallback?: T } = {}): Promise<T> => {
	const attempts = opts.attempts ?? 3;
	const delayMs = opts.delayMs ?? 200;
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt < attempts) {
				await sleep(delayMs);
			} else if (Object.prototype.hasOwnProperty.call(opts, "fallback")) {
				return opts.fallback as T;
			}
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

test.beforeAll(async ({ browser }, testInfo) => {
	testInfo.setTimeout(25_000);

	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	const page = await context.newPage();
	await page.goto(baseURL);
	await page.waitForSelector('body[hydrated="true"]', { timeout: 20000 });
	await page.waitForSelector("#app-splash", { state: "detached", timeout: 20000 });
	await context.close();
});

// NOTE: using customer list for sync test...we could also test for other cases, but if sync is working here (and reactivity is there -- different tests)
// the sync should work for other cases all the same
//
test("should update UI when remote-only changes arrive via sync", async ({ page }) => {
	// Use a database name with .sqlite3 extension to test the FSNotify bug.
	// The bug: fileEventNameToDbId used path.parse().name which strips the extension,
	// causing a mismatch between how listeners register (with extension) and how
	// file events are converted to dbids (without extension).
	const dbName = `sync-test-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl, dbName]
	);
	await page.reload();
	await page.goto(baseURL);

	await page.waitForFunction(() => Boolean((window as any)._app?.sync?.core?.worker?.isConnected), { timeout: 10000 });

	// Create an initial customer so we can verify sync is working
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Initial Customer", email: "initial@test.com" });

	await page.goto(appHash("customers"));

	// Wait for initial load
	const table = page.getByRole("table");
	await expect(table.getByRole("row")).toHaveCount(2); // 1 customer + header

	// Wait for sync to establish by verifying the customer has been synced to the remote via HTTP API.
	// This ensures the WebSocket connection is established and data is synced.
	const remoteDbHandle = await getRemoteDbHandle(page, remoteDbURL);
	await expect
		.poll(
			async () => {
				const remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList), {
					fallback: []
				});
				return remoteCustomers.length;
			},
			{ intervals: [250] }
		)
		.toBe(1);

	// Insert a new customer directly on the remote database via HTTP API.
	// This triggers the sync server's touchHack which touches the database file,
	// causing FSNotify to detect the change and notify connected clients.
	// The bug being tested: fileEventNameToDbId was stripping the .sqlite3 extension,
	// causing a mismatch between how listeners register (with extension) and how
	// file events are converted to dbids (without extension).
	await retry(
		() =>
			remoteDbHandle.evaluate(upsertCustomer, {
				id: 99,
				displayId: "99",
				fullname: "External Process Customer",
				email: "external@test.com"
			}),
		{ attempts: 5, delayMs: 300 }
	);

	await page.evaluate(() => {
		(window as any).__lastIncoming = [];
		(window as any).__progressSeen = [];
		const app = (window as any)._app;
		(window as any).__progressUnsub?.();
		(window as any).__progressUnsub = app?.sync?.syncProgressStore?.subscribe?.((v: any) => {
			(window as any).__progressSeen.push(v);
		});
	});

	await expect
		.poll(
			async () => {
				return page.evaluate(async () => {
					const w = window as any;
					const db = await w._getDb(w._app);
					const localCustomers = await w.customers.getCustomerOrderList(db);
					return localCustomers.some((customer: any) => customer.id === 99);
				});
			},
			{ timeout: 15000, intervals: [250] }
		)
		.toBe(true);

	// Capture progress artifacts for debugging (won't fail test but useful)
	const seen = await page.evaluate(() => (window as any).__progressSeen?.length || 0);
	expect(seen).toBeGreaterThan(0);

	// This must appear without any local interaction
	// With the bug (extension stripped), this will timeout because FSNotify won't find listeners
	await table.getByRole("row").filter({ hasText: "External Process Customer" }).waitFor({ timeout: 8000 });
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
	await retry(() => remoteDbHandle.evaluate(upsertCustomer, { id: 5, displayId: "5", fullname: "Customer 5", email: "cus5@email.com" }));
	// Wait for UPDATE B
	await customerRow.filter({ hasText: "Customer 4" }).getByText("cus4@email.com").waitFor();
	await customerRow.filter({ hasText: "Customer 5" }).getByText("cus5@email.com").waitFor();
	// Check for UPDATE A in remote
	let remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList));
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
	await retry(() => remoteDbHandle.evaluate(upsertCustomer, { id: 4, displayId: "4", fullname: "Customer 4 - updated remotely" }));
	// Wait for UPDATE B
	await customerRow.filter({ hasText: "Customer 4 - updated remotely" }).getByText("cus4@email.com").waitFor();
	await customerRow.filter({ hasText: "Customer 5 - updated locally" }).getByText("cus5@email.com").waitFor();
	// Check for UPDATE A in remote
	remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList));
	// updated_at DESC ordering
	expect(remoteCustomers[0].id).toEqual(4);
	expect(remoteCustomers[0].fullname).toEqual("Customer 4 - updated remotely");
	expect(remoteCustomers[1].id).toEqual(5);
	expect(remoteCustomers[1].fullname).toEqual("Customer 5 - updated locally");
});

test("initial sync optimization should replace local db from remote snapshot", async ({ page }) => {
	const remoteDbHandle = await getRemoteDbHandle(page, remoteDbURL);

	await retry(() =>
		remoteDbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Remote Customer", email: "remote@example.com" })
	);
	const remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList));
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

test("footer shows pending changes while offline and clears after resync", async ({ page }) => {
	const dbName = `pending-test-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl, dbName]
	);
	await page.goto(baseURL);

	// Seed local + ensure sync is working
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Baseline Customer", email: "baseline@test.com" });
	const remoteDbHandle = await getRemoteDbHandle(page, remoteDbURL);
	await expect
		.poll(
			async () => {
				const remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList), { fallback: [] });
				return remoteCustomers.some((customer) => customer.fullname === "Baseline Customer");
			},
			{ intervals: [250] }
		)
		.toBe(true);

	// Go offline for sync and make a new change
	await page.evaluate(() => window.localStorage.setItem("librocco-sync-active", "false"));
	await page.reload();
	await page.goto(baseURL);

	const offlineDbHandle = await getDbHandle(page);
	await offlineDbHandle.evaluate(upsertCustomer, {
		id: 2,
		displayId: "2",
		fullname: "Offline Pending Customer",
		email: "pending@test.com"
	});

	const badge = page.getByTestId("remote-db-badge");
	await expect(badge).toContainText(/pending/i);

	// Re-enable sync and wait for the pending change to clear + reach server
	await page.evaluate(() => window.localStorage.setItem("librocco-sync-active", "true"));
	await page.reload();
	await page.goto(baseURL);

	const refreshedRemoteHandle = await getRemoteDbHandle(page, remoteDbURL);
	await expect
		.poll(async () => {
			const remoteCustomers = await retry(() => refreshedRemoteHandle.evaluate(getCustomerOrderList), { fallback: [] });
			return remoteCustomers.some((customer) => customer.fullname === "Offline Pending Customer");
		})
		.toBe(true);

	await expect(page.getByTestId("remote-db-badge")).not.toContainText(/pending/i);
});

test("sync progress reports change counts instead of chunk counts", async ({ page }) => {
	const dbName = `progress-test-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "false");
		},
		[syncUrl, dbName]
	);
	await page.goto(baseURL);

	// Keep DB non-empty to avoid snapshot shortcut
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Seed Customer", email: "seed@test.com" });

	// Prepare a large batch of remote-only changes
	const remoteDbHandle = await getRemoteDbHandle(page, remoteDbURL);
	await retry(
		() =>
			remoteDbHandle.evaluate(async (db, count) => {
				for (let i = 0; i < count; i++) {
					await window.customers.upsertCustomer(db, {
						id: 10_000 + i,
						displayId: String(10_000 + i),
						fullname: `Remote Bulk ${i}`,
						email: `remote-bulk-${i}@test.com`
					});
				}
			}, 60),
		{ attempts: 5, delayMs: 300 }
	);

	// Turn sync on to pull the bulk changes
	await page.evaluate(() => window.localStorage.setItem("librocco-sync-active", "true"));
	await page.reload();
	await page.goto(baseURL);

	// Track progress directly from the Svelte store to avoid dialog debounce flakiness
	await page.waitForFunction(() => Boolean((window as any)._app?.sync?.syncProgressStore), { timeout: 10000 });
	await page.evaluate(() => {
		const app = (window as any)._app;
		(window as any).__maxProgress = 0;
		(window as any).__progressUnsub?.();
		(window as any).__progressUnsub = app.sync.syncProgressStore.subscribe((v: any) => {
			if (v.nTotal > (window as any).__maxProgress) {
				(window as any).__maxProgress = v.nTotal;
			}
			(window as any).__lastIncoming = (window as any).__lastIncoming || [];
			(window as any).__lastIncoming.push(v);
		});
	});

	await expect
		.poll(async () => page.evaluate(() => (window as any).__maxProgress ?? 0), { timeout: 20000, intervals: [250] })
		.toBeGreaterThan(50);
});
