import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard, getDbHandle } from "@/helpers";

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
		.map((_, i) => ({ isbn: i.toString(10).padStart(10, "0"), quantity: 1 }));

	// Setup: create a warehouse and add a bunch of entries
	const db = await getDbHandle(page);
	await db.evaluate(
		(db, entries) =>
			Promise.all([
				// Add fake book data for each transaction as the won't be matched otherwise
				// We're matching transactions using isbn here, a book data entry (albeit and empty one) has to exist
				//
				// TODO: we might want to update the functionality so that books an be matched by isbn-only
				db.books().upsert(entries.map(({ isbn }) => ({ title: "", price: 0, isbn }))),
				db
					.warehouse("warehouse-1")
					.create()
					.then((w) => w.setName({}, "Warehouse 1"))
					.then((w) => w.note("note-1").create())
					.then((n) => n.addVolumes(...entries))
					.then((n) => n.commit({}))
			]),
		entries
	);
	await new Promise((res) => setTimeout(res, 3000));

	const dashboard = getDashboard(page);
	const table = dashboard.content().table("warehouse");

	// Start search (no entries will be shown before)
	await dashboard.content().searchField().type("000"); // Should match all ISBNS from the data set

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
