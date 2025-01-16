import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard, getDbHandle } from "@/helpers";
import { addVolumesToNote, commitNote, createInboundNote, upsertWarehouse } from "@/helpers/cr-sqlite";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the inventory page
	await dashboard.navigate("stock");
	await page.getByText("Search for stock").waitFor();
	await new Promise((res) => setTimeout(res, 100));
});

test("should progressively load entries until all are shown", async ({ page }) => {
	const entries = Array(100)
		.fill(null)
		.map((_, i) => ({ isbn: i.toString(10).padStart(10, "0"), quantity: 1, warehouseId: 1 }));

	// Setup: create a warehouse and add a bunch of entries
	const db = await getDbHandle(page);
	await db.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await db.evaluate(createInboundNote, { id: 1, warehouseId: 1 } as const);
	for (const e of entries) {
		await db.evaluate(addVolumesToNote, [1, e] as const);
	}
	await db.evaluate(commitNote, 1);

	await new Promise((res) => setTimeout(res, 3000));

	const dashboard = getDashboard(page);
	const table = dashboard.content().table("warehouse");

	// Start search (no entries will be shown before)
	await dashboard.content().searchField().type("000"); // Should match all ISBNS from the data set

	// We're not making any assertions before scrolling the 20th row into view, triggering loading of the next contingent,
	// to avoid flakiness, as this will sometimes load automatically and sometimes not
	await table.row(19).waitFor();
	await table.row(19).scrollIntoViewIfNeeded();

	// We're saving on assertions and asserting only at breakpoints (every 40 rows)
	await table.row(39).assertFields(entries[39]);
	await table.row(40).waitFor({ state: "detached" }); // 41st row (index 40) isn't loaded yet

	// Scroll to the bottom
	await table.row(39).scrollIntoViewIfNeeded();

	// The next 40 rows should be loaded
	await table.row(39).assertFields(entries[39]);
	await table.row(79).assertFields(entries[79]);
	await table.row(80).waitFor({ state: "detached" }); // 81st row (index 80) isn't loaded yet

	// Load the last contingent
	await table.row(79).scrollIntoViewIfNeeded();

	// There are 100 entries in total
	await table.row(39).assertFields(entries[39]);
	await table.row(79).assertFields(entries[79]);
	await table.row(99).assertFields(entries[99]);
	await table.row(100).waitFor({ state: "detached" });

	// Double check to make sure
	await table.row(99).scrollIntoViewIfNeeded();

	// Nothing should change
	await table.row(39).assertFields(entries[39]);
	await table.row(79).assertFields(entries[79]);
	await table.row(99).assertFields(entries[99]);
	await table.row(100).waitFor({ state: "detached" });
});
