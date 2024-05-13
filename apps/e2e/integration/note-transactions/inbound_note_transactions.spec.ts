import { test } from "@playwright/test";

import { baseURL } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";

import { book1 } from "../data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	await dashboard.navigate("inventory");
	await dashboard.content().navigate("inbound-list");

	// We create a warehouse and a note for all tests
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("wh-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
			.then((wh) => wh.note("note-1").create())
			.then((n) => n.setName({}, "Note 1"))
	);

	// Navigate to the note page
	await dashboard.content().entityList("inbound-list").item(0).edit();
	await dashboard.content().header().title().assert("Note 1");
});

test("should display correct transaction fields for the inbound-note note view", async ({ page }) => {
	// Setup: Add the book data to the database
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db, book) => db.books().upsert([book]), book1);

	const content = getDashboard(page).content();

	// Add the transaction to the note
	await content.scanField().add(book1.isbn);

	// Check the displayed transaction (field by field)
	const row = content.table("inbound-note").row(0);
	await row.field("isbn").assert(book1.isbn);
	await row.field("title").assert(book1.title);
	await row.field("authors").assert(book1.authors);
	// The default quantity is 1
	await row.field("quantity").assert(1);
	await row.field("price").assert(book1.price);
	await row.field("year").assert(book1.year);
	await row.field("publisher").assert(book1.publisher);
	await row.field("editedBy").assert(book1.editedBy);
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();
	await row.field("outOfPrint").assert(book1.outOfPrint);
});

test("should show empty or \"N/A\" fields and not 'null' or 'undefined' (in case no book data is provided)", async ({ page }) => {
	const content = getDashboard(page).content();

	// Add a book transaction without book data (only isbn)
	await content.scanField().add("1234567890");

	// Check the displayed transaction (field by field)
	const row = content.table("inbound-note").row(0);
	await row.field("isbn").assert(book1.isbn);
	await row.field("title").assert("N/A");
	await row.field("authors").assert("N/A");
	// The default quantity is 1
	await row.field("quantity").assert(1);
	await row.field("price").assert("N/A" as any);
	await row.field("year").assert("N/A");
	await row.field("publisher").assert("");
	await row.field("editedBy").assert("");
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();
	await row.field("outOfPrint").assert(false);
});

test("should add a transaction to the note by 'typing the ISBN into the 'Scan' field and pressing \"Enter\" (the same way scenner interaction would be processed)", async ({
	page
}) => {
	const content = getDashboard(page).content();

	// Open the book form with the isbn added to the form using the 'Scan' field
	await content.scanField().add("1234567890");

	// Check updates in the entries table
	await content.table("inbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test("should aggregate the quantity for the same isbn", async ({ page }) => {
	// Setup: Add two transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		db.warehouse("wh-1").note("note-1").addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1234567891", quantity: 1 })
	);

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("inbound-note");

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
	await dbHandle.evaluate(async (db, book) => db.books().upsert([book]), book1);

	const content = getDashboard(page).content();

	// Add book 1 again (this time using only isbn and 'Add' button)
	await content.scanField().add(book1.isbn);

	// Check that the new note contains the full book data in the transaction
	await content.table("inbound-note").row(0).assertFields(book1);
});

test("should allow for changing of transaction quantity using the quantity field", async ({ page }) => {
	// Setup: Add one transaction to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) => db.warehouse("wh-1").note("note-1").addVolumes({ isbn: "1234567890", quantity: 1 }));

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("inbound-note");

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
	const entries = getDashboard(page).content().table("inbound-note");

	// We're adding books in non-alphabetical order to check if they're sorted correctly
	await scanField.add("1234567891");
	await entries.assertRows([{ isbn: "1234567891" }]);

	await scanField.add("1234567890");
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }]);

	await scanField.add("1234567892");
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }, { isbn: "1234567892" }]);
});

test("should delete the transaction from the note on delete button click", async ({ page }) => {
	// Setup: Add three transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		db
			.warehouse("wh-1")
			.note("note-1")
			.addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1234567891", quantity: 1 }, { isbn: "1234567892", quantity: 1 })
	);

	const entries = getDashboard(page).content().table("inbound-note");

	// Wait for all the entries to be displayed before selection/deletion (to reduce flakiness)
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }, { isbn: "1234567892" }]);

	// Delete the second transaction
	await entries.row(1).delete();

	// Check that the second transaction was deleted
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567892" }]);
});

// TODO: Should not allow committing of an empty note ??
