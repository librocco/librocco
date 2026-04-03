/**
 * Multi-tab tests for the SharedWorker DB migration.
 *
 * These tests verify that multiple browser tabs can open the same database
 * simultaneously without lock contention (the bug fixed by the SharedWorker migration).
 *
 * Prior to the fix: Tab 2 would hang for 30 seconds then show ErrDBInitTimeout.
 * After the fix: Tab 2 connects to the already-running SharedWorker in ~50ms.
 */

import { expect } from "@playwright/test";

import { baseURL } from "@/constants";
import { testBase as test } from "@/helpers/fixtures";

// The SharedWorker should attach Tab 2 to an already-running worker — well under 10s.
// The old behavior was a 30s hard timeout followed by an error.
const TAB2_READY_TIMEOUT = 10_000;

const waitForDbReady = async (page: import("@playwright/test").Page, timeout = TAB2_READY_TIMEOUT) => {
	// #app-splash is detached from the DOM when the DB reaches AppDbState.Ready.
	// If the DB errors out (ErrDBInitTimeout etc.) the splash stays — test will fail here.
	await page.waitForSelector("#app-splash", { state: "detached", timeout });
};

test("two tabs open the same DB — both reach db_ready without timeout", async ({ page }) => {
	// Tab 1 is already loaded and db_ready (testBase fixture handles setup + navigation).
	// Tab 2 shares the same browser context → same origin → same localStorage → same DB ID.
	const page2 = await page.context().newPage();
	try {
		await page2.goto(baseURL);
		// This would hang for 30s then fail with ErrDBInitTimeout before the SharedWorker fix.
		await waitForDbReady(page2);

		// Both tabs should have db_ready set.
		const tab1Ready = await page.evaluate(() => Boolean((window as any).db_ready));
		const tab2Ready = await page2.evaluate(() => Boolean((window as any).db_ready));
		expect(tab1Ready).toBe(true);
		expect(tab2Ready).toBe(true);
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
	// The SharedWorker must keep running because Tab 2 still has an active port.
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

test("reloading a tab reconnects to the SharedWorker within timeout", async ({ page }) => {
	// Tab 1 is already ready.
	await page.reload();
	// After reload, a new port is created that connects to the same-named SharedWorker
	// (or a fresh one if the old one was GC'd). Either way, db_ready must fire within
	// the standard timeout.
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
