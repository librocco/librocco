import { expect, test } from "@playwright/test";

import { baseURL } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";
import {
	addVolumesToNote,
	commitNote,
	createInboundNote,
	createOutboundNote,
	updateNote,
	upsertBook,
	upsertNoteCustomItem,
	upsertWarehouse
} from "@/helpers/cr-sqlite";

import { book1 } from "../data";
import { compareEntries } from "@/helpers/utils";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	// We create a warehouse and a note for all tests
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });

	await dbHandle.evaluate(createOutboundNote, { id: 1 });
	await dbHandle.evaluate(updateNote, { id: 1, displayName: "Note 1" });

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	await page.getByRole("link", { name: "Outbound" }).click();
	await dashboard.content().entityList("outbound-list").waitFor();

	// Navigate to the note page
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.getByRole("main").getByRole("heading", { name: "Note 1" }).first();
});

test("should display correct transaction fields for the outbound note view", async ({ page }) => {
	// Setup: Add the book data to the database
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertBook, book1);

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
	await row.field("price").assert("€0.00");
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

test("should aggregate the quantity for the same isbn", async ({ page }) => {
	// Setup: Add two transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 1 }] as const);

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	await content.entityList("outbound-list").item(0).edit();
	// Check that both books are in the entries table
	// (by not using 'strict: true', we're asserting only by values we care about)
	await entries.assertRows([
		{ isbn: "1234567891", quantity: 1 },
		{ isbn: "1234567890", quantity: 1 }
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
	await dbHandle.evaluate(upsertBook, book1);

	const content = getDashboard(page).content();

	// Add book 1 again (this time using only isbn and 'Add' button)
	await content.scanField().add(book1.isbn);

	// Check that the new note contains the full book data in the transaction
	await content.table("outbound-note").row(0).assertFields(book1);
});

test("should allow for changing of transaction quantity using the quantity field", async ({ page }) => {
	// Setup: Add one transaction to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	await content.entityList("outbound-list").item(0).edit();
	// Wait for the transaction to appear on screen before proceeding with assertions
	await entries.assertRows([{ isbn: "1234567890", quantity: 1 }]);

	// Change the quantity of the transaction
	await entries.row(0).field("quantity").set(3);

	await entries.assertRows([{ isbn: "1234567890", quantity: 3 }]);

	// Add second transaction to check that the quantity of the first transaction has made the round trip
	// (it will have done so before the second transaction appears in the table)
	await scanField.add("1234567891");

	await entries.assertRows([
		{ isbn: "1234567891", quantity: 1 },
		{ isbn: "1234567890", quantity: 3 }
	]);
});

test("should sort in reverse order to being added/aggregated", async ({ page }) => {
	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("inbound-note");

	// We're adding books in non-alphabetical order to check if they're sorted correctly
	await scanField.add("1234567891");
	await entries.assertRows([{ isbn: "1234567891" }]);

	await scanField.add("1234567890");
	await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }]);

	await scanField.add("1234567892");
	await entries.assertRows([{ isbn: "1234567892" }, { isbn: "1234567890" }, { isbn: "1234567891" }]);

	// Aggregating should push the aggregated txn up
	await scanField.add("1234567891");
	await entries.assertRows([{ isbn: "1234567891" }, { isbn: "1234567892" }, { isbn: "1234567890" }]);
});

test("should delete the transaction from the note when when selected for deletion and deletion confirmed", async ({ page }) => {
	// Setup: Add three transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567892", quantity: 1, warehouseId: 1 }] as const);

	const entries = getDashboard(page).content().table("outbound-note");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	await content.entityList("outbound-list").item(0).edit();
	// Wait for all the entries to be displayed before selection/deletion (to reduce flakiness)
	await entries.assertRows([{ isbn: "1234567892" }, { isbn: "1234567891" }, { isbn: "1234567890" }]);

	// Delete the second transaction
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await entries.row(1).getByRole("button").click();
	await page.getByTestId("delete-row").click();

	// Check that the second transaction was deleted
	await entries.assertRows([{ isbn: "1234567892" }, { isbn: "1234567890" }]);
});

// TODO: Rethink this...
test.skip("transaction should default to the only warehouse the given book is available in if there is only one", async ({ page }) => {
	// Setup: Add the book to the warehouse (through an inbound note)
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

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
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "1234567890", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Warehouse without book in stock should still be available for selection (out-of-stock is handled at a later step)
	await dbHandle.evaluate(upsertWarehouse, { id: 3, displayName: "Warehouse 3" });

	const scanField = getDashboard(page).content().scanField();
	const row = getDashboard(page).content().table("outbound-note").row(0);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	await content.entityList("outbound-list").item(0).edit();
	// Add a book transaction to the note
	await scanField.add("1234567890");

	// Assert relevant fields (isbn, quantity and warehouseName)
	await row.assertFields({ isbn: "1234567890", quantity: 1, warehouseName: "" });
	// Check row's available warehouses
	await row.field("warehouseName").assertOptions(["Warehouse 1", "Warehouse 2", "Warehouse 3"]);
});

test("if there's one transaction for the isbn with specified warehouse, should add a new transaction (with unspecified warehouse) on 'Add'", async ({
	page
}) => {
	// Setup: Create two warehouses with the book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "1234567890", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Add a transaction to the note, belonging to the first warehouse - specified warehouse
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("outbound-note");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	await content.entityList("outbound-list").item(0).edit();
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

	await entries.assertRows([
		{ isbn: "1234567890", quantity: 1, warehouseName: "" },
		{ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" }
	]);
});

test("if there are two transactions, one with specified and one with unspecified warehouse should aggregate the one with unspecified warehouse on 'Add'", async ({
	page
}) => {
	// Setup: Create two warehouses with the book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "1234567890", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Add a transaction to the note, belonging to the first warehouse - specified warehouse
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1 }] as const);

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

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });

	// Add two transactions to the note, one belonging to the first warehouse  and one belonging to the second warehouse (both specified)
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 2, warehouseId: 2 }] as const);

	const entries = getDashboard(page).content().table("outbound-note");
	const dashboard = getDashboard(page);
	const content = dashboard.content();

	await content.entityList("outbound-list").item(0).edit();
	// Wait for the transactions to be displayed before continuing with assertions
	await entries.assertRows([
		{ isbn: "1234567890", quantity: 2, warehouseName: "Warehouse 2" },
		{ isbn: "1234567890", quantity: 3, warehouseName: "Warehouse 1" }
	]);

	// Change the warehouse of the first transaction to the same as the second transaction
	await entries.row(0).field("warehouseName").set("Warehouse 1");

	await entries.assertRows([{ isbn: "1234567890", quantity: 5, warehouseName: "Warehouse 1" }]);
});

test("should add custom item on 'Custom Item' button click after filling out the form", async ({ page }) => {
	// Setup: add one non-custom transaction
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "11111111", quantity: 1 }] as const);

	const content = getDashboard(page).content();

	await content.entityList("outbound-list").item(0).edit();
	// Add a custom item using custom item button
	await content.getByRole("button", { name: "Custom Item" }).click();
	// The custom item form appears automatically, when adding a new custom item
	const form = getDashboard(page).customItemForm();
	await form.fillData({ title: "Item 1", price: 5 });
	await form.submit();

	// A new custom item should appear under book transactions
	await content.table("outbound-note").assertRows([
		{ title: "Item 1", price: 5 },
		{ isbn: "11111111", quantity: 1 }
	]);

	await content.scanField().add("22222222"); // Add new book item
	await content.getByRole("button", { name: "Custom Item" }).click(); // Add new custom item
	await form.fillData({ title: "Item 2", price: 20 });
	await form.submit();

	await content.table("outbound-note").assertRows([
		{ title: "Item 2", price: 20 },
		{ isbn: "22222222", quantity: 1 },
		// Custom items are not aggregated (each has a unique internal id)
		{ title: "Item 1", price: 5 },
		{ isbn: "11111111", quantity: 1 }
	]);

	// Opening up a form and and cancelling shouldn't add anything
	await content.getByRole("button", { name: "Custom item" }).click();
	await form.cancel();

	await content.table("outbound-note").assertRows([
		{ title: "Item 2", price: 20 },
		{ isbn: "22222222", quantity: 1 },
		{ title: "Item 1", price: 5 },
		{ isbn: "11111111", quantity: 1 }
	]);
});

test("should allow for editing of custom items using the custom item form", async ({ page }) => {
	// Setup: add two custom items and two book rows (as noise)
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "11111111", quantity: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "22222222", quantity: 1 }] as const);
	await dbHandle.evaluate(upsertNoteCustomItem, [1, { id: 1, title: "Custom item 1", price: 10 }] as const);
	await dbHandle.evaluate(upsertNoteCustomItem, [1, { id: 2, title: "Custom item 2", price: 10 }] as const);

	const content = getDashboard(page).content();

	await content.entityList("outbound-list").item(0).edit();
	// Edit custom items using custom item form
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await content.table("outbound-note").row(1).getByRole("button").click();
	await page.getByTestId("edit-row").click();

	await getDashboard(page).customItemForm().fillData({ title: "Custom item 1 - updated" });
	await getDashboard(page).customItemForm().submit();

	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await content.table("outbound-note").row(0).getByRole("button").click();
	await page.getByTestId("edit-row").click();

	await getDashboard(page).customItemForm().fillData({ title: "Custom item 2 - updated", price: 12 });
	await getDashboard(page).customItemForm().submit();

	await content.table("outbound-note").assertRows([
		{ title: "Custom item 2 - updated", price: 12 },
		{ title: "Custom item 1 - updated", price: 10 },
		{ isbn: "22222222", quantity: 1 },
		{ isbn: "11111111", quantity: 1 }
	]);
});

test("should check validity of the transactions and commit the note on 'commit' button click", async ({ page }) => {
	const dbHandle = await getDbHandle(page);

	// Setup - add some stock
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "11111111", quantity: 4, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "22222222", quantity: 5, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "11111111", quantity: 2, warehouseId: 2 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "22222222", quantity: 2, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Txn Ok
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "11111111", quantity: 3, warehouseId: 1 }] as const);
	// Out-of-stock - available 2, requested 3
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "11111111", quantity: 3, warehouseId: 2 }] as const);
	// No warehouse assigned
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "22222222", quantity: 5 }] as const);
	// Out-of-stock - available 0, required, 2
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "33333333", quantity: 2, warehouseId: 1 }] as const);
	// No warehouse assigned
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "44444444", quantity: 1 }] as const);

	const dashboard = getDashboard(page);

	// It seems to help to navigate again to the outbound page after all of the dbHandle's have been evaluated
	await page.getByRole("link", { name: "Edit" }).first().click();

	const entries = dashboard.content().table("outbound-note");
	const dialog = dashboard.dialog();

	const invalidTransctionList = dialog.locator("ul");

	// Try to commit the note
	await page.getByRole("button", { name: "Commit" }).click();
	await dialog.confirm();

	// Should display no-warehouse-selected error dialog
	await dialog.getByText("No warehouse(s) selected").waitFor();
	// Should display isbns for transactions with no warehouse selected
	await compareEntries(invalidTransctionList, ["22222222", "44444444"], "li");

	// Close the dialog and fix the invalid transactions
	const noWarehouseSelectedDialog = page.getByRole("dialog", { name: "No warehouse(s) selected" });
	await noWarehouseSelectedDialog.getByRole("button", { name: "Cancel" }).click();

	await expect(noWarehouseSelectedDialog).not.toBeVisible();

	// "22222222" - reverse order than order of adding/aggregating
	await entries.row(2).field("warehouseName").set("Warehouse 1");
	// "44444444"
	await entries.row(0).field("warehouseName").set("Warehouse 2");

	await entries.assertRows([
		// Out of stock - the book doesn't exist in warehouse
		{ isbn: "44444444", quantity: 1, warehouseName: "Warehouse 2" },
		// Out of stock - the book doesn't exist in warehouse
		{ isbn: "33333333", quantity: 2, warehouseName: "Warehouse 1" },
		// All fine, enough books in stock (required 5, 5 available in the warehouse)
		{ isbn: "22222222", quantity: 5, warehouseName: "Warehouse 1" },
		// Invalid - out of stock (required 3, only 2 available in the warehouse)
		{ isbn: "11111111", quantity: 3, warehouseName: "Warehouse 2" },
		// All fine, enough books in stock (required 3, 4 available in the warehouse)
		{ isbn: "11111111", quantity: 3, warehouseName: "Warehouse 1" }
	]);

	// Try to commit the note
	await page.getByRole("button", { name: "Commit" }).click();
	// Regression: check the commit message (book count was broken -- this tests the fix)
	//
	// 1 + 2 + 5 + 3 + 3 = 14
	await page.getByRole("dialog").getByText("14 books will be removed from your stock").waitFor();
	// Commit
	await dialog.confirm();

	// Dialog should show the out-of-stock error
	await dialog.getByText("Stock mismatch").waitFor();

	// Invalid transactions:
	// "44444444" (Warehouse 2) - required: 1, available: 0
	await invalidTransctionList.locator("li").nth(0).getByText("44444444 in Warehouse 2").waitFor();
	await invalidTransctionList.locator("li").nth(0).getByText("requested quantity: 1").waitFor();
	await invalidTransctionList.locator("li").nth(0).getByText("available: 0").waitFor();
	await invalidTransctionList.locator("li").nth(0).getByText("quantity for reconciliation: 1").waitFor();
	// "33333333" (Warehouse 1) - required: 2, available: 0
	await invalidTransctionList.locator("li").nth(1).getByText("33333333 in Warehouse 1").waitFor();
	await invalidTransctionList.locator("li").nth(1).getByText("requested quantity: 2").waitFor();
	await invalidTransctionList.locator("li").nth(1).getByText("available: 0").waitFor();
	await invalidTransctionList.locator("li").nth(1).getByText("quantity for reconciliation: 2").waitFor();
	// "11111111" (Warehouse 2) - required: 3, available: 2
	await invalidTransctionList.locator("li").nth(2).getByText("11111111 in Warehouse 2").waitFor();
	await invalidTransctionList.locator("li").nth(2).getByText("requested quantity: 3").waitFor();
	await invalidTransctionList.locator("li").nth(2).getByText("available: 2").waitFor();
	await invalidTransctionList.locator("li").nth(2).getByText("quantity for reconciliation: 1").waitFor();
	// That's it, no more rows
	await invalidTransctionList.locator("li").nth(3).waitFor({ state: "detached" });

	// Confirm the reconciliation
	const stockMisMatchDialog = page.getByRole("dialog", { name: "Stock mismatch" });
	await stockMisMatchDialog.getByRole("button", { name: "Confirm" }).click();
	await expect(stockMisMatchDialog).not.toBeVisible();

	// The note should be committed, we're redirected to '/outbound' page
	await dashboard.view("outbound").waitFor();

	// Check Wareahouse 1 stock (only the existing books should have been removed)
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await dashboard.content().entityList("warehouse-list").item(0).dropdown().viewStock();
	await dashboard
		.content()
		.table("warehouse")
		.assertRows([{ isbn: "11111111", quantity: 1 }]);

	// Check Wareahouse 2 stock (only the existing books should have been removed)
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await dashboard.content().entityList("warehouse-list").item(1).dropdown().viewStock();
	await dashboard
		.content()
		.table("warehouse")
		.assertRows([{ isbn: "22222222", quantity: 2 }]);
});

// TODO: Should not allow committing of an empty note ??
