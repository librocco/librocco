import { expect, request, type Page } from "@playwright/test";

import { IS_CI, appHash, baseURL, remoteDbURL, syncUrl } from "@/constants";

import { testBase as test, testOrders } from "@/helpers/fixtures";

import { getDbHandle, getCustomerOrderList, getRemoteDbHandle, resetRemoteDb, upsertCustomer } from "@/helpers/cr-sqlite";
import {
	isSyncServerCircusControlAvailable,
	startSyncServerViaCircus,
	stopSyncServerViaCircus,
	waitForSyncServerCircusStatus
} from "@/helpers/circus";

test.setTimeout(45_000);
const SERVER_WAIT_TIMEOUT_MS = 45_000;
const WARMUP_TIMEOUT_MS = IS_CI ? 25_000 : 10_000;
// Startup budget: server boot wait + warmup + headroom for browser/context setup in slower CI executors.
const BEFORE_ALL_TIMEOUT_MS = SERVER_WAIT_TIMEOUT_MS + WARMUP_TIMEOUT_MS + 15_000;

const getStableRemoteDbHandle = (page: Page) => retry(() => getRemoteDbHandle(page, remoteDbURL), { attempts: 5, delayMs: 300 });

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
	testInfo.setTimeout(BEFORE_ALL_TIMEOUT_MS);

	await waitForServer(SERVER_WAIT_TIMEOUT_MS);

	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	const page = await context.newPage();
	try {
		await warmupApp(page, WARMUP_TIMEOUT_MS);
	} catch (error) {
		// Best-effort warmup: if the splash never detaches we still proceed with the real tests.
		console.warn(`Warmup page did not finish before timeout (${WARMUP_TIMEOUT_MS}ms)`, error);
	} finally {
		try {
			await context.close();
		} catch (error) {
			console.warn("Warmup context failed to close cleanly", error);
		}
	}
});

async function warmupApp(page: Page, timeoutMs: number): Promise<void> {
	// Best-effort warmup: only ensure the page responds. Avoid app-level readiness gates
	// (`hydrated`, splash detach) which can be slow/flaky under CI load.
	await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
}

async function waitForHttpReady(
	url: string,
	timeoutMs = 45_000,
	isReady: (status: number) => boolean = (status) => status >= 200 && status < 300
) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const ctx = await request.newContext({ ignoreHTTPSErrors: true });
		try {
			const resp = await ctx.get(url);
			if (isReady(resp.status())) {
				return;
			}
		} catch {
			// ignore and retry
		} finally {
			await ctx.dispose();
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw new Error(`Server at ${url} not reachable after ${timeoutMs}ms`);
}

async function waitForServer(timeoutMs = 45_000) {
	await waitForHttpReady(baseURL, timeoutMs);
}

async function waitForSyncServerDatabaseHealthy(dbName: string, timeoutMs = 60_000) {
	const healthUrl = new URL(`${encodeURIComponent(dbName)}/health`, remoteDbURL).toString();
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const ctx = await request.newContext({ ignoreHTTPSErrors: true });
		try {
			const resp = await ctx.get(healthUrl);
			if (resp.status() === 200) {
				const body = (await resp.json().catch((): { ok?: boolean } | null => null)) as { ok?: boolean } | null;
				if (body?.ok === true) {
					return;
				}
			}
		} catch {
			// ignore and retry
		} finally {
			await ctx.dispose();
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	throw new Error(`Sync DB health at ${healthUrl} not healthy after ${timeoutMs}ms`);
}

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
	await page.goto(baseURL);

	// Create an initial customer so we can verify sync is working
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Initial Customer", email: "initial@test.com" });

	await page.goto(appHash("customers"));

	// Wait for initial load
	const table = page.getByRole("table");
	await expect(table.getByRole("row")).toHaveCount(2); // 1 customer + header

	// Wait for sync to establish by verifying the customer has been synced to the remote via HTTP API.
	// This ensures the WebSocket connection is established and data is synced.
	const remoteDbHandle = await getStableRemoteDbHandle(page);
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
	const remoteDbHandle = await getStableRemoteDbHandle(page);

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
	const dbName = `initial-sync-opt-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			// Keep sync off while preparing remote-only seed data.
			window.localStorage.setItem("librocco-sync-active", "false");
		},
		[syncUrl, dbName]
	);
	await page.goto(baseURL);

	const remoteDbHandle = await getStableRemoteDbHandle(page);

	await retry(() =>
		remoteDbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Remote Customer", email: "remote@example.com" })
	);
	const remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList));
	expect(remoteCustomers.some((customer) => customer.id === 1)).toBe(true);

	// Trigger public sync startup path; for an empty local DB this exercises initial snapshot optimisation.
	await page.evaluate(() => {
		window.localStorage.setItem("librocco-sync-active", "true");
	});

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
	await expect
		.poll(
			async () => {
				const remoteDbHandle = await getStableRemoteDbHandle(page);
				try {
					const remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList), { fallback: [] });
					return remoteCustomers.some((customer) => customer.fullname === "Baseline Customer");
				} catch {
					return false;
				}
			},
			{ timeout: 25000, intervals: [250] }
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
	// With sync explicitly disabled, the badge label is "sync disabled".
	// Pending is exposed as structured metadata, not as label text.
	await expect(badge).toHaveAttribute("data-status", "disconnected");
	await expect
		.poll(async () => Number((await badge.getAttribute("data-pending")) || "0"), {
			timeout: 5000,
			intervals: [250]
		})
		.toBeGreaterThan(0);

	// Re-enable sync and wait for the pending change to clear + reach server
	await page.evaluate(() => window.localStorage.setItem("librocco-sync-active", "true"));
	await page.reload();
	await page.goto(baseURL);

	await expect
		.poll(
			async () => {
				const refreshedRemoteHandle = await getStableRemoteDbHandle(page);
				try {
					const remoteCustomers = await retry(() => refreshedRemoteHandle.evaluate(getCustomerOrderList), { fallback: [] });
					return remoteCustomers.some((customer) => customer.fullname === "Offline Pending Customer");
				} catch {
					return false;
				}
			},
			{ timeout: 25000, intervals: [250] }
		)
		.toBe(true);

	await expect
		.poll(async () => Number((await page.getByTestId("remote-db-badge").getAttribute("data-pending")) || "0"), {
			timeout: 10000,
			intervals: [250]
		})
		.toBe(0);
});

test("remote DB indicator turns red when syncserver stops and recovers after restart", async ({ page }, testInfo) => {
	testInfo.setTimeout(60_000);

	const circusControlAvailable = await isSyncServerCircusControlAvailable();
	if (!circusControlAvailable) {
		if (IS_CI) {
			throw new Error("Circus control for syncserver is unavailable in CI. Refusing to skip the Remote DB indicator stop/start test.");
		}
		test.skip(true, "Circus control for syncserver is not available in this environment");
	}

	const dbName = `sync-indicator-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await startSyncServerViaCircus();
	await waitForSyncServerCircusStatus("active");

	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl, dbName]
	);
	await page.goto(baseURL);

	const badgeStatus = () => page.getAttribute('[data-testid="remote-db-badge"]', "data-status");
	await expect.poll(badgeStatus, { timeout: 20000, intervals: [250] }).toBe("synced");

	try {
		await stopSyncServerViaCircus();
		await waitForSyncServerCircusStatus("stopped");

		await expect.poll(badgeStatus, { timeout: 25000, intervals: [250] }).toBe("stuck");

		await page.reload();
		await page.goto(baseURL);
		await expect.poll(badgeStatus, { timeout: 25000, intervals: [250] }).toBe("stuck");
	} finally {
		await startSyncServerViaCircus();
		await waitForSyncServerCircusStatus("active");
	}

	await expect.poll(badgeStatus, { timeout: 25000, intervals: [250] }).toBe("synced");
});

test("shows incompatible state when remote DB is rebuilt and recovers after nuke and resync", async ({ page }) => {
	const dbName = `compat-test-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl, dbName]
	);
	await page.route("**/meta", (route) => route.abort());
	await page.goto(baseURL);
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, displayId: "1", fullname: "Compat Baseline", email: "compat@test.com" });

	await expect
		.poll(
			async () => {
				const remoteDbHandle = await getStableRemoteDbHandle(page);
				const remoteCustomers = await retry(() => remoteDbHandle.evaluate(getCustomerOrderList), { fallback: [] });
				return remoteCustomers.some((customer) => customer.fullname === "Compat Baseline");
			},
			{ timeout: 20000, intervals: [250] }
		)
		.toBe(true);

	await resetRemoteDb(page, remoteDbURL, dbName);

	// Track status transitions after reload to verify "synced" never appears
	await page.reload();
	await page.goto(baseURL);

	await page.evaluate(() => {
		(window as any).__statusHistory = [] as string[];
		const badge = document.querySelector('[data-testid="remote-db-badge"]');
		if (badge) {
			const initial = badge.getAttribute("data-status");
			if (initial) (window as any).__statusHistory.push(initial);
			const observer = new MutationObserver((mutations) => {
				for (const m of mutations) {
					if (m.attributeName === "data-status") {
						const val = (m.target as HTMLElement).getAttribute("data-status");
						if (val) (window as any).__statusHistory.push(val);
					}
				}
			});
			observer.observe(badge, { attributes: true, attributeFilter: ["data-status"] });
		}
	});

	await expect(page.getByTestId("remote-db-badge")).toHaveAttribute("data-status", "incompatible", { timeout: 5000 });

	// The badge should never have shown "synced" before becoming "incompatible"
	const statusHistory = await page.evaluate(() => (window as any).__statusHistory as string[]);
	expect(statusHistory).not.toContain("synced");

	// The modal should show the specific incompatibility message, not the vague network message
	await expect(page.locator(".modal-box")).toContainText(/changed identity/i);

	await page.getByRole("button", { name: /nuke/i }).click();

	await expect
		.poll(async () => page.getAttribute('[data-testid="remote-db-badge"]', "data-status"), {
			timeout: 20000,
			intervals: [250]
		})
		.toBe("synced");

	const refreshedDbHandle = await getDbHandle(page);
	await refreshedDbHandle.evaluate(upsertCustomer, { id: 2, displayId: "2", fullname: "Post Resync Customer", email: "post@test.com" });

	await expect
		.poll(
			async () => {
				const refreshedRemoteHandle = await getStableRemoteDbHandle(page);
				const remoteCustomers = await retry(() => refreshedRemoteHandle.evaluate(getCustomerOrderList), { fallback: [] });
				return remoteCustomers.some((customer) => customer.fullname === "Post Resync Customer");
			},
			{ timeout: 20000, intervals: [250] }
		)
		.toBe(true);
});

test("surfaces apply failures after a successful handshake", async ({ page }) => {
	const dbName = `apply-fail-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl, dbName]
	);

	await page.goto(baseURL);
	await expect(page.getByTestId("remote-db-badge")).toHaveAttribute("data-status", "synced", { timeout: 20000 });

	const triggerEndpoint = new URL(`${dbName}/exec`, remoteDbURL).toString();
	const response = await page.request.post(triggerEndpoint, {
		data: {
			sql: `
        CREATE TRIGGER IF NOT EXISTS crsql_block_inbound
        BEFORE INSERT ON customer
        BEGIN
          SELECT RAISE(FAIL, 'apply blocked for test');
        END;
      `
		}
	});
	expect(response.ok()).toBe(true);

	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, {
		id: 501,
		displayId: "501",
		fullname: "Inbound Failure",
		email: "applyfail@test.com"
	});

	await expect(page.getByTestId("remote-db-badge")).toHaveAttribute("data-status", "incompatible", { timeout: 15000 });
	await expect(page.getByTestId("remote-db-badge")).toHaveAttribute("data-status", "incompatible");
	await expect
		.poll(async () => Number((await page.getAttribute('[data-testid="remote-db-badge"]', "data-pending")) || "0"), {
			timeout: 5000,
			intervals: [250]
		})
		.toBeGreaterThan(0);
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
	await retry(
		async () => {
			const remoteDbHandle = await getStableRemoteDbHandle(page);
			return remoteDbHandle.evaluate(async (db, count) => {
				for (let i = 0; i < count; i++) {
					for (let attempts = 0; attempts < 8; attempts++) {
						try {
							await window.customers.upsertCustomer(db, {
								id: 10_000 + i,
								displayId: String(10_000 + i),
								fullname: `Remote Bulk ${i}`,
								email: `remote-bulk-${i}@test.com`
							});
							break;
						} catch (err) {
							if (attempts === 7) {
								throw err;
							}
							await new Promise((resolve) => setTimeout(resolve, 200));
						}
					}
				}
			}, 60);
		},
		{ attempts: 6, delayMs: 500 }
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

test("sync status stays consistent across two tabs during stop/restart", async ({ page }, testInfo) => {
	testInfo.setTimeout(180_000);

	const circusControlAvailable = await isSyncServerCircusControlAvailable();
	if (!circusControlAvailable) {
		if (IS_CI) {
			throw new Error("Circus control for syncserver is unavailable in CI. Refusing to skip the multi-tab sync consistency test.");
		}
		test.skip(true, "Circus control for syncserver is not available in this environment");
	}

	const dbName = `sync-multitab-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await startSyncServerViaCircus();
	await waitForSyncServerCircusStatus("active");

	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
			// Use a multi-tab friendly VFS for this scenario to avoid OPFS lock contention.
			window.localStorage.setItem("vfs", "asyncify-idb-batch-atomic");
		},
		[syncUrl, dbName]
	);
	await page.goto(baseURL);

	const page2 = await page.context().newPage();
	await page2.goto(baseURL);
	await page2.waitForSelector('body[hydrated="true"]', { timeout: 30_000 });
	await page2.waitForSelector("#app-splash", { state: "detached", timeout: 30_000 });

	const statusOf = async (p: Page) => p.getAttribute('[data-testid="remote-db-badge"]', "data-status");
	const waitUntilSynced = async (p: Page, timeout = 25_000) => {
		await expect.poll(() => statusOf(p), { timeout, intervals: [250] }).toBe("synced");
	};
	const postRestartSyncTimeout = 90_000;
	await waitUntilSynced(page);
	await waitUntilSynced(page2);

	try {
		await stopSyncServerViaCircus();
		await waitForSyncServerCircusStatus("stopped");

		// Each tab can compute reconnect-loop diagnostics independently; require both
		// tabs to be out of "synced", without forcing equal status labels.
		await expect
			.poll(
				async () => {
					const s = await statusOf(page);
					return s != null && s !== "synced";
				},
				{ timeout: 30_000, intervals: [250] }
			)
			.toBe(true);
		await expect
			.poll(
				async () => {
					const s = await statusOf(page2);
					return s != null && s !== "synced";
				},
				{ timeout: 30_000, intervals: [250] }
			)
			.toBe(true);
	} finally {
		await startSyncServerViaCircus();
		await waitForSyncServerCircusStatus("active");
		await waitForSyncServerDatabaseHealthy(dbName, 120_000);
	}

	await waitUntilSynced(page, postRestartSyncTimeout);
	await waitUntilSynced(page2, postRestartSyncTimeout);
	await page2.close();
});

test("surfaces pending_stale when queue age is old while pending exists", async ({ page }, testInfo) => {
	testInfo.setTimeout(90_000);

	const dbName = `pending-stale-db-${Math.floor(Math.random() * 1000000)}.sqlite3`;
	await page.evaluate(
		([syncUrl, dbName]) => {
			window.localStorage.setItem("librocco-current-db", `"${dbName}"`);
			window.localStorage.setItem("librocco-sync-url", `"${syncUrl}"`);
			window.localStorage.setItem("librocco-sync-active", "true");
		},
		[syncUrl, dbName]
	);
	await page.goto(baseURL);

	await expect
		.poll(async () => page.getAttribute('[data-testid="remote-db-badge"]', "data-status"), {
			timeout: 30_000,
			intervals: [250]
		})
		.toBe("synced");

	const dbid = await page.evaluate(() => JSON.parse(window.localStorage.getItem("librocco-current-db") || '""'));
	await page.evaluate(
		([dbid]) => {
			const old = Date.now() - 180_000;
			const sinceKey = `librocco-sync-pending-since-${dbid}`;
			const oldJson = JSON.stringify(old);
			window.localStorage.setItem(sinceKey, oldJson);
			// Storage events do not fire in the same document by default; dispatch one so
			// sync-pending store consumes the stale timestamp immediately.
			window.dispatchEvent(new StorageEvent("storage", { key: sinceKey, newValue: oldJson }));
		},
		[dbid]
	);

	await page.evaluate(() => {
		const badge = document.querySelector('[data-testid="remote-db-badge"]');
		const reasonHistory: string[] = [];
		const pushCurrentReason = () => {
			if (!badge) return;
			const reason = badge.getAttribute("data-reason");
			if (reason) reasonHistory.push(reason);
		};
		pushCurrentReason();
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.attributeName === "data-reason") {
					pushCurrentReason();
				}
			}
		});
		if (badge) observer.observe(badge, { attributes: true, attributeFilter: ["data-reason"] });
		(window as any).__pendingReasonHistory = reasonHistory;
		(window as any).__pendingReasonObserver = observer;
	});

	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Pending-since is already stale; first pending transition should surface pending_stale.
		for (let i = 0; i < 900; i++) {
			await window.customers.upsertCustomer(db, {
				id: 30_000 + i,
				displayId: String(30_000 + i),
				fullname: `Offline Bulk ${i}`,
				email: `offline-bulk-${i}@test.com`
			});
		}
	});

	await expect
		.poll(async () => Number((await page.getAttribute('[data-testid="remote-db-badge"]', "data-pending")) || "0"), {
			timeout: 15_000,
			intervals: [100]
		})
		.toBeGreaterThan(0);

	await expect
		.poll(
			async () => {
				return page.evaluate(() => ((window as any).__pendingReasonHistory as string[])?.includes("pending_stale") ?? false);
			},
			{
				timeout: 30_000,
				intervals: [100]
			}
		)
		.toBe(true);

	await page.evaluate(() => {
		(window as any).__pendingReasonObserver?.disconnect?.();
	});
});
