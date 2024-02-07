import { expect, test } from "@playwright/test";

import { baseURL } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";

import { book1 } from "../../legacy/data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	await dashboard.navigate("outbound");
	await dashboard.content().entityList("outbound-list").waitFor();

	// We create a warehouse and a note for all tests
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);

	// Navigate to the note page
	await dashboard.content().entityList("outbound-list").item(0).edit();
	await dashboard.content().header().title().assert("Note 1");
});

test("should display correct transaction fields for the outbound note view", async ({ page }) => {
	// Setup: Add the book data to the database
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db, book) => db.books().upsert([book]), book1);

	const content = getDashboard(page).content();

	// Add the transaction to the note
	await content.scanField().add(book1.isbn);

	// Check the displayed transaction (field by field)
	const row = content.table("outbound-note").row(0);
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
	const content = getDashboard(page).content();

	// Add a book transaction without book data (only isbn)
	await content.scanField().add("1234567890");

	// Check the displayed transaction (field by field)
	const row = content.table("outbound-note").row(0);
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

test("should add a transaction to the note by 'typing the ISBN into the 'Scan' field and pressing \"Enter\" (the same way scenner interaction would be processed)", async ({
	page
}) => {
	const content = getDashboard(page).content();

	await content.scanField().add("1234567890");

	// Check updates in the entries table
	await content.table("outbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test("should capture keyboard events if typing in numbers and direct the input to the 'Scan' field even if scan field not focused", async ({
	page
}) => {
	const content = getDashboard(page).content();

	// Wait for the field to be rendered before typing
	await content.scanField().waitFor();

	// Type in the isbn in the 'Scan' field
	await page.keyboard.type("1234567890");
	await page.keyboard.press("Enter");

	await content.table("outbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test("should aggregate the quantity for the same isbn", async ({ page }) => {
	// Setup: Add two transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db.warehouse().note("note-1").addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1234567891", quantity: 1 })
	);

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	// Check that both books are in the entries table
	// (by not using 'strict: true', we're asserting only by values we care about)
	await entries.assertRows([
		{ isbn: "1234567890", quantity: 1 },
		{ isbn: "1234567891", quantity: 1 }
	]);

	// Add another transaction for "1234567890"
	await scanField.add("1234567890");

	// No new transaction should be added, but the quantity of "1234567890" should be increased
	await entries.assertRows([
		{ isbn: "1234567890", quantity: 2 },
		{ isbn: "1234567891", quantity: 1 }
	]);
});

test("should autofill the existing book data when adding a transaction with existing isbn", async ({ page }) => {
	// Setup: Add book data to the database
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db, book) => db.books().upsert([book]), book1);

	const content = getDashboard(page).content();

	// Add book 1 again (this time using only isbn and 'Add' button)
	await content.scanField().add(book1.isbn);

	// Check that the new note contains the full book data in the transaction
	await content.table("outbound-note").row(0).assertFields(book1);
});

test("should allow for changing of transaction quantity using the quantity field", async ({ page }) => {
	// Setup: Add one transaction to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) => db.warehouse().note("note-1").addVolumes({ isbn: "1234567890", quantity: 1 }));

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	// Wait for the transaction to appear on screen before proceeding with assertions
	await entries.assertRows([{ isbn: "1234567890", quantity: 1 }]);

	// Change the quantity of the transaction
	await entries.row(0).field("quantity").set(3);

	await entries.assertRows([{ isbn: "1234567890", quantity: 3 }]);

	// Add second transaction to check that the quantity of the first transaction has made the round trip
	// (it will have done so before the second transaction appears in the table)
	await scanField.add("1234567891");

	await entries.assertRows([
		{ isbn: "1234567890", quantity: 3 },
		{ isbn: "1234567891", quantity: 1 }
	]);
});

test("should sort transactions by isbn", async ({ page }) => {
	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	// We're adding books in non-alphabetical order to check if they're sorted correctly
	await scanField.add("1234567891");
	await entries.assertRows([{ isbn: "1234567891" }]);

	await scanField.add("1234567890");
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }]);

	await scanField.add("1234567892");
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }, { isbn: "1234567892" }]);
});

test("should delete the transaction from the note when when selected for deletion and deletion confirmed", async ({ page }) => {
	// Setup: Add three transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-1")
			.addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1234567891", quantity: 1 }, { isbn: "1234567892", quantity: 1 })
	);

	const entries = getDashboard(page).content().table("outbound-note");

	// Wait for all the entries to be displayed before selection/deletion (to reduce flakiness)
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }, { isbn: "1234567892" }]);

	// Delete the second transaction
	await entries.row(1).delete();

	// Check that the second transaction was deleted
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567892" }]);
});

// TODO: This test is failing as the functionality is not working, we should fix this
test("transaction should default to the only warehouse the given book is available in if there is only one", async ({ page }) => {
	// Setup: Add the book to the warehouse (through an inbound note)
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		db.warehouse("wh-1")
			.setName({}, "Warehouse 1")
			.then((wh) => wh.note().create())
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 1 }))
			.then((n) => n.commit({}));
	});

	const content = getDashboard(page).content();

	// Add a book transaction to the note
	await content.scanField().add("1234567890");

	// TDDO: Replace the following with a single call to `assertFields` (commented line below) when the
	// warehouse picker's single-option / multiple option implementation is reconciled
	await content.table("outbound-note").row(0).field("isbn").assert("1234567890");
	await content.table("outbound-note").row(0).field("quantity").assert(1);
	await expect(content.table("outbound-note").row(0).field("warehouseName")).toContainText("Warehouse 1");
	// await content.table("outbound-note").row(0).assertFields({ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" });
});

test("transaction should allow for warehouse selection if there is more than one warehouse the given book is available in", async ({
	page
}) => {
	// Setup: Create two warehouses with the book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
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

	const scanField = getDashboard(page).content().scanField();
	const row = getDashboard(page).content().table("outbound-note").row(0);

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
		// Add a transaction to the note, belonging to the first warehouse - specified warehouse
		await db.warehouse().note("note-1").addVolumes({ isbn: "1234567890", quantity: 1, warehouseId: `wh-1` });
	});

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	// Wait for the transaction to be displayed before continuing with assertions
	//
	// TDDO: Replace the following with a single call to `assertRows` (commented line below) when the
	// warehouse picker's single-option / multiple option implementation is reconciled
	await entries.row(0).field("isbn").assert("1234567890");
	await entries.row(0).field("quantity").assert(1);
	await expect(entries.row(0).field("warehouseName")).toContainText("Warehouse 1");
	await entries.row(1).waitFor({ state: "detached" });
	// await entries.assertRows([{ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" }]);

	// Add another transaction for the same book (should default to "" warehouse)
	await scanField.add("1234567890");

	// TDDO: Replace the following with a single call to `assertRows` (commented lines below) when the
	// warehouse picker's single-option / multiple option implementation is reconciled
	await entries.row(0).field("isbn").assert("1234567890");
	await entries.row(0).field("quantity").assert(1);
	await expect(entries.row(0).field("warehouseName")).toContainText("not-found");
	await entries.row(1).field("isbn").assert("1234567890");
	await entries.row(1).field("quantity").assert(1);
	await expect(entries.row(1).field("warehouseName")).toContainText("Warehouse 1");
	await entries.row(2).waitFor({ state: "detached" });
	// await entries.assertRows([
	// 	{ isbn: "1234567890", quantity: 1, warehouseName: "" },
	// 	{ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" }
	// ]);
});

test("if there are two transactions, one with specified and one with unspecified warehouse should aggregate the one with unspecified warehouse on 'Add'", async ({
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
		// Add two transactions to the note, one belonging to the first warehouse (specified warehouse) and one with unspecified warehouse
		await db
			.warehouse()
			.note("note-1")
			.addVolumes({ isbn: "1234567890", quantity: 1, warehouseId: `wh-1` }, { isbn: "1234567890", quantity: 1 });
	});

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	// Wait for the transactions to be displayed before continuing with assertions
	await entries.assertRows([
		{ isbn: "1234567890", quantity: 1, warehouseName: "" },
		{ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" }
	]);

	// Add yet another transaction for the same book (should default to "" warehouse and aggregate with the first entry)
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
		// Add two transactions to the note, one belonging to the first warehouse (specified warehouse) and one belonging to the second warehouse
		await db
			.warehouse()
			.note("note-1")
			.addVolumes({ isbn: "1234567890", quantity: 3, warehouseId: `wh-1` }, { isbn: "1234567890", quantity: 2, warehouseId: `wh-2` });
	});

	const entries = getDashboard(page).content().table("outbound-note");

	// Wait for the transactions to be displayed before continuing with assertions
	await entries.assertRows([
		{ isbn: "1234567890", quantity: 3, warehouseName: "Warehouse 1" },
		{ isbn: "1234567890", quantity: 2, warehouseName: "Warehouse 2" }
	]);

	// Change the warehouse of the first transaction to the same as the second transaction
	await entries.row(0).field("warehouseName").set("Warehouse 2");

	await entries.assertRows([{ isbn: "1234567890", quantity: 5, warehouseName: "Warehouse 2" }]);
});
