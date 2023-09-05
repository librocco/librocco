import { test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard, getDbHandle } from "../helpers";

import { book1 } from "./data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();
});

test("should apply warehouse discount (when set) to the entries displayed (in stock view)", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(
		(db, book1) =>
			Promise.all([
				// Add book data to the db
				db.books().upsert([{ ...book1, price: 10 }]),
				db
					// Create a warehouse
					.warehouse("wh-1")
					.create()
					.then((w) => w.setName({}, "Warehouse 1"))
					// Add book to stock via inbound note
					.then((w) => w.note("note-1").create())
					.then((n) => n.addVolumes({ isbn: book1.isbn, quantity: 1 }))
					.then((n) => n.commit({}))
			]),
		book1
	);

	const sidebar = getDashboard(page).sidebar();
	const content = getDashboard(page).content();

	// Navigate to the warehouse page
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();

	// Should display the book without the discount
	await content.entries("stock").assertRows([{ ...book1, quantity: 1, price: 10 }]);

	// Set the discount
	await content.discount().set(20);

	// Should apply the discount to the displayed entries
	await content.entries("stock").assertRows([{ ...book1, quantity: 1, price: 8 }]);
});

test("should apply warehouse discount (when set) to the entries displayed (in inbound note view)", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(
		(db, book1) =>
			Promise.all([
				// Add book data to the db
				db.books().upsert([{ ...book1, price: 10 }]),
				db
					// Create a warehouse
					.warehouse("wh-1")
					.create()
					.then((w) => w.setName({}, "Warehouse 1"))
					// Create an inbound note with the book added to it
					.then((w) => w.note("note-1").create())
					.then((n) => n.setName({}, "Note 1"))
					.then((n) => n.addVolumes({ isbn: book1.isbn, quantity: 1 }))
			]),
		book1
	);

	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Navigate to inbound note page
	await dashboard.navigate("inbound");
	await sidebar.linkGroup("Warehouse 1").open();
	await sidebar.linkGroup("Warehouse 1").link("Note 1").click();
	await content.heading("Note 1").waitFor();

	// Should display the book without the discount
	await content.entries("inbound").assertRows([{ ...book1, quantity: 1, price: 10 }]);

	// Set the discount (back at the warehouse page)
	await dashboard.navigate("stock");
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.discount().set(20);

	// Should apply the discount to the entries in the inbound note
	await dashboard.navigate("inbound");
	await sidebar.linkGroup("Warehouse 1").open();
	await sidebar.linkGroup("Warehouse 1").link("Note 1").click();
	await content.heading("Note 1").waitFor();
	await content.entries("inbound").assertRows([{ ...book1, quantity: 1, price: 8 }]);
});

test("should apply warehouse discount for the appropriate warehouse, (when set) to the entries displayed (in outbound note view)", async ({
	page
}) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db, book1) => {
		Promise.all([
			// Add book data to the db
			db.books().upsert([{ ...book1, price: 10 }]),
			// Create two warehouses
			db
				.warehouse("wh-1")
				.create()
				.then((w) => w.setName({}, "Warehouse 1")),
			db
				.warehouse("wh-2")
				.create()
				.then((w) => w.setName({}, "Warehouse 2"))
		]);
		// Create an outbound note
		await db
			.warehouse()
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
			// Add the same book, but to two different warehouses
			.then((n) =>
				n.addVolumes({ isbn: book1.isbn, quantity: 1, warehouseId: "wh-1" }, { isbn: book1.isbn, quantity: 1, warehouseId: "wh-2" })
			);
	}, book1);

	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Navigate to inbound note page
	await dashboard.navigate("outbound");
	await sidebar.link("Note 1").click();
	await content.heading("Note 1").waitFor();

	// Should display the books without discount applied
	await content.entries("outbound").assertRows([
		{ ...book1, quantity: 1, price: 10, warehouseId: "wh-1", warehouseName: "Warehouse 1" },
		{ ...book1, quantity: 1, price: 10, warehouseId: "wh-2", warehouseName: "Warehouse 2" }
	]);

	// Set the discount for Warehouse 1 (back at the warehouse page)
	await dashboard.navigate("stock");
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.discount().set(20);

	// Should apply the discount to the entries in the inbound note
	await dashboard.navigate("outbound");
	await sidebar.link("Note 1").click();
	await content.heading("Note 1").waitFor();
	await content.entries("outbound").assertRows([
		// First transaction (belonging to Warehouse 1) should have the discount applied
		{ ...book1, quantity: 1, price: 8, warehouseId: "wh-1", warehouseName: "Warehouse 1" },
		// Second transaction belongs to Warehouse 2, so no discount applied
		{ ...book1, quantity: 1, price: 10, warehouseId: "wh-2", warehouseName: "Warehouse 2" }
	]);
});
