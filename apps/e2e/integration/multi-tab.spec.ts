/**
 * Multi-tab tests for the shared service DB architecture.
 *
 * These tests verify that multiple browser tabs can open the same database
 * simultaneously without OPFS lock contention. The shared service pattern
 * elects one tab as leader (owning the DedicatedWorker + OPFS handle) and
 * routes other tabs' DB requests through MessagePorts to that worker.
 *
 * Prior to the fix: Tab 2 would hang for 30s then show ErrDBInitTimeout.
 * After the fix: Tab 2 connects via the shared service relay in ~50ms.
 */

import { expect, type Page } from "@playwright/test";

import { baseURL } from "@/constants";
import { testBase as test } from "@/helpers/fixtures";
import { getDbHandle, createOutboundNote } from "@/helpers/cr-sqlite";
import { getDashboard } from "@/helpers/dashboard";

/**
 * Returns the worker type chosen by worker-db.ts for this page.
 * In environments with SharedWorker support, the shared service pattern is used.
 * In iOS Safari or test environments without SharedWorker, DedicatedWorker fallback.
 */
const getWorkerType = (page: Page) => page.evaluate(() => (window as any).__librocco_worker_type as string | undefined);

// Multi-tab tests involve multiple full page loads + DB init + shared service port
// negotiation (which includes a 3s request timeout + retry cycle), so they need more
// time than the default 15s Playwright test timeout.
test.setTimeout(45_000);

// The shared service should connect additional tabs to the leader's worker well under
// the old 30s hard timeout. 15s gives headroom for shared service port negotiation
// (3s request timeout + retry) plus Vite dev server compilation under load.
const TAB2_READY_TIMEOUT = 15_000;

const waitForDbReady = async (page: Page, timeout = TAB2_READY_TIMEOUT) => {
	// #app-splash is detached from the DOM when the DB reaches AppDbState.Ready.
	// If the DB errors out (ErrDBInitTimeout etc.) the splash stays — test will fail here.
	await page.waitForSelector("#app-splash", { state: "detached", timeout });
};

test("two tabs open the same DB — both reach db_ready without timeout", async ({ page }) => {
	// Tab 1 is already loaded and db_ready (testBase fixture handles setup + navigation).
	// Tab 2 shares the same browser context -> same origin -> same localStorage -> same DB ID.
	const page2 = await page.context().newPage();
	try {
		await page2.goto(baseURL);
		// This would hang for 30s then fail with ErrDBInitTimeout before the shared service fix.
		await waitForDbReady(page2);

		// Both tabs should have db_ready set.
		const tab1Ready = await page.evaluate(() => Boolean((window as any).db_ready));
		const tab2Ready = await page2.evaluate(() => Boolean((window as any).db_ready));
		expect(tab1Ready).toBe(true);
		expect(tab2Ready).toBe(true);

		// Both tabs should report the same worker type.
		const [tab1Type, tab2Type] = await Promise.all([getWorkerType(page), getWorkerType(page2)]);
		expect(tab1Type).toBeDefined();
		expect(tab1Type).toBe(tab2Type);
	} finally {
		await page2.close();
	}
});

test("closing tab1 does not break tab2", async ({ page }) => {
	// Open Tab 2 and wait for it to be ready.
	const page2 = await page.context().newPage();
	await page2.goto(baseURL);
	await waitForDbReady(page2);

	// Close Tab 1 (simulate user closing the first tab).
	// With shared service: if Tab 1 was the leader, Tab 2 should auto-promote
	// and re-initialize its own DedicatedWorker via leader election.
	await page.close();

	// Tab 2 should still be functional — db_ready should still be true
	// and the app should not have entered an error state.
	const tab2Ready = await page2.evaluate(() => Boolean((window as any).db_ready));
	expect(tab2Ready).toBe(true);

	// Basic sanity: we can query the DOM without any error overlay blocking us.
	const errorDialog = page2.locator('[role="alertdialog"]');
	const errorDialogCount = await errorDialog.count();
	expect(errorDialogCount).toBe(0);

	await page2.close();
});

test("reloading a tab reconnects within timeout", async ({ page }) => {
	// Tab 1 is already ready.
	await page.reload();
	// After reload, a new SharedService instance participates in leader election
	// and gets a port to the worker. db_ready must fire within the standard timeout.
	await waitForDbReady(page);

	const isReady = await page.evaluate(() => Boolean((window as any).db_ready));
	expect(isReady).toBe(true);
});

test("three tabs — all reach db_ready", async ({ page }) => {
	const page2 = await page.context().newPage();
	const page3 = await page.context().newPage();
	try {
		await Promise.all([page2.goto(baseURL), page3.goto(baseURL)]);
		await Promise.all([waitForDbReady(page2), waitForDbReady(page3)]);

		const [r1, r2, r3] = await Promise.all([
			page.evaluate(() => Boolean((window as any).db_ready)),
			page2.evaluate(() => Boolean((window as any).db_ready)),
			page3.evaluate(() => Boolean((window as any).db_ready))
		]);
		expect(r1).toBe(true);
		expect(r2).toBe(true);
		expect(r3).toBe(true);
	} finally {
		await page2.close();
		await page3.close();
	}
});

test("Cross-tab reactivity: note created in tab1 appears in tab2", async ({ page }) => {
	// Tab 1: navigate to Sale page.
	await page.getByRole("link", { name: "Sale" }).click();
	const dashboard1 = getDashboard(page);
	const entityList1 = dashboard1.content().entityList("outbound-list");

	// Confirm the list starts empty.
	await entityList1.assertElements([]);

	// Tab 2: open a new tab and navigate to the same Sale page.
	const page2 = await page.context().newPage();
	try {
		await page2.goto(baseURL);
		await waitForDbReady(page2);
		await page2.getByRole("link", { name: "Sale" }).click();
		const dashboard2 = getDashboard(page2);
		const entityList2 = dashboard2.content().entityList("outbound-list");
		await entityList2.assertElements([]);

		// Tab 1: create a note via the DB handle.
		const dbHandle = await getDbHandle(page);
		await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Cross-Tab Note" });

		// Tab 1: the note should appear in the list (local reactivity).
		await entityList1.assertElements([{ name: "Cross-Tab Note" }]);

		// Tab 2: the note should also appear (cross-tab reactivity via TblRx BroadcastChannel).
		await entityList2.assertElements([{ name: "Cross-Tab Note" }]);
	} finally {
		await page2.close();
	}
});
