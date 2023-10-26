import { test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard, getDbHandle } from "../helpers";

import { book1 } from "./data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);
	// Wait for the app to become responsive
	const dashboard = getDashboard(page);
	await dashboard.waitFor();
});

test("update is reflected in table view - stock", async ({ page }) => {
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

	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();
	const bookForm = dashboard.bookForm();

	// Check warehouse stock view
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows(
		[
			{
				isbn: "1234567890",
				quantity: 1
			}
		],
		{ strict: true }
	);

	// Edit the book data
	await content.entries("stock").row(0).getByRole("button", { name: "Edit" }).click();
	await bookForm.fillBookData(book1);
	await bookForm.submit("click");

	// The row should have been updated
	await content.entries("stock").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});

test("update is reflected in table view - inbound", async ({ page }) => {
	// Setup
	//
	// Create the warehouse containing a note
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

	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();
	const bookForm = dashboard.bookForm();

	await dashboard.navigate("inbound");

	// Navigate to note and check entries
	await sidebar.linkGroup("Warehouse 1").open();
	await sidebar.linkGroup("Warehouse 1").link("Note 1").click();
	await content.heading("Note 1").waitFor();
	await content.entries("inbound").assertRows(
		[
			{
				isbn: "1234567890",
				quantity: 1
			}
		],
		{ strict: true }
	);

	// Edit the book data
	await content.entries("inbound").row(0).getByRole("button", { name: "Edit" }).click();
	await bookForm.fillBookData(book1);
	await bookForm.submit("click");

	// The row should have been updated
	await content.entries("inbound").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});

test("update is reflected in table view - outbound", async ({ page }) => {
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

	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();
	const bookForm = dashboard.bookForm();

	await dashboard.navigate("outbound");

	// Navigate to note and check entries
	await sidebar.link("Note 1").click();
	await content.heading("Note 1").waitFor();
	await content.entries("outbound").assertRows(
		[
			{
				isbn: "1234567890",
				quantity: 1
			}
		],
		{ strict: true }
	);

	// Edit the book data
	await content.entries("outbound").row(0).getByRole("button", { name: "Edit" }).click();
	await bookForm.fillBookData(book1);
	await bookForm.submit("click");

	// The row should have been updated
	await content.entries("outbound").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});
