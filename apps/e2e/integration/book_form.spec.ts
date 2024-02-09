import { test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard, getDbHandle } from "@/helpers";

import { book1 } from "./data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);
});

test("update is reflected in table view - stock", async ({ page }) => {
	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Wait for the app to become responsive
	await dashboard.navigate("inventory");
	await content.entityList("warehouse-list").waitFor();

	// Setup
	//
	// Create the warehouse containing a certain book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
			.then((wh) => wh.note().create())
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
			.then((n) => n.commit({}))
	);

	// Navigate to the warehouse page
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.header().title().assert("Warehouse 1");
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 1 }], { strict: true });

	// Edit the book data for the first (and only) row
	await content.table("warehouse").row(0).edit();

	const bookForm = dashboard.bookForm();
	await bookForm.fillBookData(book1);
	await bookForm.submit("keyboard");

	// The row should have been updated
	await content.table("warehouse").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});

test("update is reflected in table view - inbound", async ({ page }) => {
	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Wait for the app to become responsive
	await dashboard.navigate("inventory");
	await content.navigate("inbound-list");

	// Setup
	//
	// Create a warehouse and a note containing a certain book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
			.then((wh) => wh.note().create())
			.then((n) => n.setName({}, "Note 1"))
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
	);

	// Navigate to the note page
	await content.entityList("inbound-list").item(0).edit();
	await content.header().title().assert("Note 1");
	await content.table("inbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }], { strict: true });

	// Edit the book data for the first (and only) row
	await content.table("inbound-note").row(0).edit();

	const bookForm = dashboard.bookForm();
	await bookForm.fillBookData(book1);
	await bookForm.submit("keyboard");

	// The row should have been updated
	await content.table("inbound-note").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});

test("update is reflected in table view - outbound", async ({ page }) => {
	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Wait for the app to become responsive
	await dashboard.navigate("outbound");
	await content.entityList("outbound-list").waitFor();

	// Setup
	//
	// Create a note containing a certain book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Note 1"))
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
	);

	// Navigate to the note page
	await content.entityList("outbound-list").item(0).edit();
	await content.header().title().assert("Note 1");
	await content.table("outbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }], { strict: true });

	// Edit the book data for the first (and only) row
	await content.table("outbound-note").row(0).edit();

	const bookForm = dashboard.bookForm();
	await bookForm.fillBookData(book1);
	await bookForm.submit("keyboard");

	// The row should have been updated
	await content.table("outbound-note").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});
