import { test } from "@playwright/test";

import { baseURL } from "../../constants";

import { getDashboard, getDbHandle } from "../../helpers";

import { runCommonTransactionTests } from "./shared_tests";

const book1 = {
	isbn: "1234567890",
	title: "Book 1",
	price: 12,
	year: "2020",
	authors: "Author and Sons",
	publisher: "Reed Elsevier",
	editedBy: "Sons",
	outOfPrint: true
};

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// Navigate to the outbound view
	await dashboard.navigate("outbound");

	// Create a new note to work with
	await getDashboard(page).sidebar().createNote();
});

test("should display correct transaction fields for the outbound note view", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Setup
	//
	// Add the book data to the database
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db, book) => db.books().upsert([book]), book1);
	// Add the transaction to the note
	await content.scanField().add(book1.isbn);

	// Check the displayed transaction (field by field)
	const row = content.entries("outbound").row(0);
	await row.field("isbn").assert(book1.isbn);
	await row.field("title").assert(book1.title);
	await row.field("authors").assert(book1.authors);
	// The default quantity is 1
	await row.field("quantity").assert(1);
	await row.field("price").assert(book1.price);
	await row.field("year").assert(book1.year);
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();

	// There is no warehouse the book is available in so 'not-found' should be displayed
	await row.field("warehouseName").assert("not-found");
});

test("should show empty or \"N/A\" fields and not 'null' or 'undefined' (in case no book data is provided)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Add a book transaction without book data (only isbn)
	await content.scanField().add("1234567890");

	// Check the displayed transaction (field by field)
	const row = content.entries("outbound").row(0);
	await row.field("isbn").assert(book1.isbn);
	await row.field("title").assert("N/A");
	await row.field("authors").assert("N/A");
	// The default quantity is 1
	await row.field("quantity").assert(1);
	await row.field("price").assert("N/A" as any);
	await row.field("year").assert("N/A");
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();

	// There is no warehouse the book is available in so 'not-found' should be displayed
	await row.field("warehouseName").assert("not-found");
});

runCommonTransactionTests("outbound");

test("transaction should default to the only warehouse the given book is available in if there is only one", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create a warehouse to work with
		const wh = await db.warehouse("wh-1").setName({}, "Warehouse 1");

		// Add the book to the warehouse (through an inbound note)
		await wh
			.note()
			.addVolumes({ isbn: "1234567890", quantity: 1 })
			.then((n) => n.commit({}));
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Add a book transaction to the note
	await content.scanField().add("1234567890");

	// Assert relevant fields (isbn, quantity and warehouseName)
	await content.entries("outbound").row(0).assertFields({ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" });
});

test("transaction should allow for warehouse selection if there is more than one warehouse the given book is available in", async ({
	page
}) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create two warehouses with the book in stock
		for (let i = 1; i <= 2; i++) {
			await db
				.warehouse(`wh-${i}`)
				.create()
				.then((wh) => wh.setName({}, `Warehouse ${i}`))
				.then((wh) => wh.note().create())
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
				.then((n) => n.commit({}));
		}

		// Create additional warehouse where the book is not available (as noise) - this warehouse shouldn't be available for selection
		await db
			.warehouse("wh-3")
			.create()
			.then((w) => w.setName({}, "Warehouse 3"));
	});

	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const scanField = content.scanField();
	const entries = content.entries("outbound");
	const row = entries.row(0);

	// Add a book transaction to the note
	await scanField.add("1234567890");

	// Assert relevant fields (isbn, quantity and warehouseName)
	await row.assertFields({ isbn: "1234567890", quantity: 1, warehouseName: "" });
	// Check row's available warehouses
	await row.field("warehouseName").assertOptions(["Warehouse 1", "Warehouse 2"]);
});

test("if there's one transaction for the isbn with specified warehouse, should add a new transaction (with unspecified warehouse) on 'Add'", async ({
	page
}) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create two warehouses with the book in stock
		for (let i = 1; i <= 2; i++) {
			await db
				.warehouse(`wh-${i}`)
				.create()
				.then((wh) => wh.setName({}, `Warehouse ${i}`))
				.then((wh) => wh.note().create())
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
				.then((n) => n.commit({}));
		}
	});

	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const scanField = content.scanField();
	const entries = content.entries("outbound");

	// Add one transaction for the book and select the first warehouse
	await scanField.add("1234567890");
	await entries.row(0).field("warehouseName").set("Warehouse 1");

	// Add another transaction for the same book (should default to "" warehouse)
	await scanField.add("1234567890");

	await entries.assertRows([
		{ isbn: "1234567890", quantity: 1, warehouseName: "" },
		{ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" }
	]);
});

test("if there are two transactions, one with specified and one with unspecified warehouse should aggregate the one with specified warehouse on 'Add'", async ({
	page
}) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create two warehouses with the book in stock
		for (let i = 1; i <= 2; i++) {
			await db
				.warehouse(`wh-${i}`)
				.create()
				.then((wh) => wh.setName({}, `Warehouse ${i}`))
				.then((wh) => wh.note().create())
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
				.then((n) => n.commit({}));
		}
	});

	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const scanField = content.scanField();
	const entries = content.entries("outbound");

	// Add one transaction for the book and select the first warehouse
	await scanField.add("1234567890");
	await entries.row(0).field("warehouseName").set("Warehouse 1");

	// Add another transaction for the same book (should default to "" warehouse)
	await scanField.add("1234567890");

	// Add yet another transaction for the same book (should default to "" warehouse and aggregate with previous one)
	await scanField.add("1234567890");

	await entries.assertRows([
		{ isbn: "1234567890", quantity: 2, warehouseName: "" },
		{ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" }
	]);
});

test("updating a transaction to an 'isbn' and 'warehouseId' of an already existing transaction should aggregate the two", async ({
	page
}) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create two warehouses with the book in stock
		for (let i = 1; i <= 2; i++) {
			await db
				.warehouse(`wh-${i}`)
				.create()
				.then((wh) => wh.setName({}, `Warehouse ${i}`))
				.then((wh) => wh.note().create())
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
				.then((n) => n.commit({}));
		}
	});

	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const scanField = content.scanField();
	const entries = content.entries("outbound");

	// Add one transaction for the book and select the first warehouse
	await scanField.add("1234567890");
	await entries.row(0).field("warehouseName").set("Warehouse 1");

	// Add another transaction for the same book (should default to "" warehouse)
	await scanField.add("1234567890");

	// Change the warehouse of the latter transaction to the same as the first one
	//
	// Note: transaction with warehouse of "" will be sorted before other transactions with the same isbn
	await entries.row(0).field("warehouseName").set("Warehouse 1");

	await entries.assertRows([{ isbn: "1234567890", quantity: 2, warehouseName: "Warehouse 1" }]);
});
