import { expect } from "@playwright/test";

import { baseURL } from "@/constants";

import { testBase as test } from "@/helpers/fixtures";
import { getDashboard, getDbHandle } from "@/helpers";
import {
	addVolumesToNote,
	commitNote,
	createInboundNote,
	createOutboundNote,
	updateNote,
	upsertBook,
	upsertNoteCustomItem,
	upsertWarehouse,
	deleteWarehouse
} from "@/helpers/cr-sqlite";

import { book1 } from "../data";

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

	await page.getByRole("link", { name: "Sale" }).click();
	await dashboard.content().entityList("outbound-list").waitFor();

	// Navigate to the note page
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.getByRole("heading", { name: "Note 1" }).first().waitFor();
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

	// There is no warehouse the book is available in so 'Select a warehouse' should be displayed
	await row.field("warehouseName").assert("Select a warehouse");
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

	// There is no warehouse the book is available in so 'select a warehouse' should be displayed
	await row.field("warehouseName").assert("Select a warehouse");
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

	// Wait for all the entries to be displayed before selection/deletion (to reduce flakiness)
	await entries.assertRows([{ isbn: "1234567892" }, { isbn: "1234567891" }, { isbn: "1234567890" }]);

	// Delete the second transaction
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await entries.row(1).getByRole("button").click();
	await page.getByTestId("delete-row").click();

	// Check that the second transaction was deleted
	await entries.assertRows([{ isbn: "1234567892" }, { isbn: "1234567890" }]);
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

	// Add a book transaction to the note
	await scanField.add("1234567890");

	// Assert relevant fields (isbn, quantity and warehouseName)
	await row.assertFields({ isbn: "1234567890", quantity: 1, warehouseName: "" });
	// Check row's available warehouses
	await row.field("warehouseName").click();

	const dropdown = page.getByTestId("dropdown-menu");
	// Check for an option that contains the text "Warehouse 1"
	await expect(dropdown.getByRole("option", { name: "Warehouse 1" })).toBeVisible();

	// Check for an option that contains the text "Warehouse 2"
	await expect(dropdown.getByRole("option", { name: "Warehouse 2" })).toBeVisible();
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

	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 5, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	const entries = getDashboard(page).content().table("outbound-note");

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

	// Add a custom item using custom item button
	await content.getByRole("button", { name: "Custom Item" }).first().click();
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
	await content.getByRole("button", { name: "Custom Item" }).first().click(); // Add new custom item
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
	await content.getByRole("button", { name: "Custom item" }).first().click();
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

test("should check validity of the transactions and commit the note on 'commit' button click", async ({ t, page }) => {
	const { sale_note: tOutbound } = t;

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

	const entries = dashboard.content().table("outbound-note");
	const dialog = dashboard.dialog();

	const invalidTransctionList = dialog.locator("ul");

	// Try to commit the note
	await page.getByRole("button", { name: "Commit" }).click();

	// We should see the "warehouse selection" validation message, as some rows haven't had warehouses selected
	const popover = await page.getByTestId("popover-commit");
	// Selecting for text here is flakey?
	await expect(popover).toBeVisible();

	// "22222222" - reverse order than order of adding/aggregating
	await entries.row(2).field("warehouseName").set("Warehouse 1");

	await entries.assertRows([
		// Forced Withdrawal - the book doesn't exist in warehouse
		{ isbn: "44444444", quantity: 1, warehouseName: "" },
		// Forced Withdrawal - the book doesn't exist in warehouse
		{ isbn: "33333333", quantity: 2, warehouseName: "Warehouse 1" },
		// All fine, enough books in stock (required 5, 5 available in the warehouse)
		{ isbn: "22222222", quantity: 5, warehouseName: "Warehouse 1" },
		// Only 2 available in the warehouse
		{ isbn: "11111111", quantity: 2, warehouseName: "Warehouse 2" },
		// Forced Withdrawal - 3rd copy doesn't exist in warehouse
		{ isbn: "11111111", quantity: 1, warehouseName: "Warehouse 2" },
		// All fine, enough books in stock (required 3, 4 available in the warehouse)
		{ isbn: "11111111", quantity: 3, warehouseName: "Warehouse 1" }
	]);

	await page.getByTestId("dropdown-control").nth(1).click();

	await page.getByRole("button", { name: "Force withdrawal" }).click();
	const forceWithdrawalDialog = page.getByRole("dialog");
	await forceWithdrawalDialog.locator("#warehouse-force-withdrawal").selectOption({ label: "Warehouse 2" });
	await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

	await entries.assertRows([
		// Forced Withdrawal - the book doesn't exist in warehouse
		{ isbn: "44444444", quantity: 1, warehouseName: "Warehouse 2" },
		// Forced Withdrawal - the book doesn't exist in warehouse
		{ isbn: "33333333", quantity: 2, warehouseName: "Warehouse 1" },
		// All fine, enough books in stock (required 5, 5 available in the warehouse)
		{ isbn: "22222222", quantity: 5, warehouseName: "Warehouse 1" },
		// Only 2 available in the warehouse
		{ isbn: "11111111", quantity: 2, warehouseName: "Warehouse 2" },
		//	 Forced Withdrawal - 3rd copy doesn't exist in warehouse
		{ isbn: "11111111", quantity: 1, warehouseName: "Warehouse 2" },
		// All fine, enough books in stock (required 3, 4 available in the warehouse)
		{ isbn: "11111111", quantity: 3, warehouseName: "Warehouse 1" }
	]);

	// Try to commit the note
	await page.getByRole("button", { name: "Commit" }).click();
	// Regression: check the commit message (book count was broken -- this tests the fix)
	//
	// 5 + 2 + 3 = 10 => Available stock
	const availableStock = 10;

	// The commit dialog should show the number of books that will be removed from stock and the detail
	// for the stock adjustments that will be made
	await expect(dialog.getByText(tOutbound.commit_dialog.title({ entity: "Note 1 " }))).toBeVisible();
	await expect(dialog.getByText(tOutbound.commit_dialog.description({ bookCount: availableStock }))).toBeVisible();

	// The stock adjustment detail should be hidden behind a <detail> summary
	const tStockAdjustmentDetail = tOutbound.commit_dialog.stock_adjustement_detail;

	await dialog.getByText(tStockAdjustmentDetail.summary()).click();

	// Invalid transactions:
	// "44444444" (Warehouse 2) - required: 1, available: 0
	// Note: I had to refactor these selectors as the existing solution stopped working with the second and third items in the list (33333, 11111)
	// after updating the copy. I couldn't figure out why, but this works.
	await expect(
		invalidTransctionList.locator("li", { hasText: tStockAdjustmentDetail.detail_list.row({ isbn: "44444444", warehouse: "Warehouse 2" }) })
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.requested({ quantity: 1 }) })
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.available({ quantity: 0 }) }).first() // could be confused with line 579
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.adjustment({ quantity: 1 }) }).first() // could be confused with line 596
	).toBeVisible();

	// "33333333" (Warehouse 1) - required: 2, available: 0
	await expect(
		invalidTransctionList.locator("li", { hasText: tStockAdjustmentDetail.detail_list.row({ isbn: "33333333", warehouse: "Warehouse 1" }) })
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.requested({ quantity: 2 }) })
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.available({ quantity: 0 }) }).nth(1)
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.adjustment({ quantity: 2 }) })
	).toBeVisible();

	// "11111111" (Warehouse 2) - required: 3, available: 2
	await expect(
		invalidTransctionList.locator("li", { hasText: tStockAdjustmentDetail.detail_list.row({ isbn: "11111111", warehouse: "Warehouse 2" }) })
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.requested({ quantity: 3 }) })
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.available({ quantity: 2 }) })
	).toBeVisible();
	await expect(
		invalidTransctionList.locator("li ul li", { hasText: tStockAdjustmentDetail.detail_list.adjustment({ quantity: 1 }) }).nth(1)
	).toBeVisible();

	// Confirm the reconciliation
	// const stockMisMatchDialog = page.getByRole("dialog", { name: "Stock mismatch" });
	// await stockMisMatchDialog.getByRole("button", { name: "Confirm" }).click();
	// Commit
	await dialog.confirm();
	await expect(dialog).not.toBeVisible();

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

test("should create a new row for the same isbn when stock is depleted", async ({ page }) => {
	// Setup: Create a warehouse and add 3 copies of a book
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	const content = getDashboard(page).content();
	const scanField = content.scanField();
	const entries = content.table("outbound-note");

	await scanField.add(isbn);

	await entries.assertRows([{ isbn: "1234567890", quantity: 1 }]);

	// Check that the transaction is of type 'Normal' as stock is available
	await entries.assertRows([{ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" }]);

	// Add the book a 4th time, which should create a new 'Forced' transaction
	await scanField.add(isbn);

	// Check that a new row has been created with type 'Forced'
	await entries.assertRows([
		{ isbn, quantity: 1, warehouseName: "" },

		{ isbn, quantity: 1, warehouseName: "Warehouse 1" }
	]);
});

test("should create a new row for the same isbn when quantity is increased beyond available stock", async ({ page }) => {
	// Setup: Create a warehouse and add 3 copies of a book
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Add a transaction for 3 copies to the current outbound note
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn, quantity: 3, warehouseId: 1 }] as const);

	const content = getDashboard(page).content();
	const entries = content.table("outbound-note");

	// Wait for the initial state
	await entries.assertRows([{ isbn, quantity: 3, warehouseName: "Warehouse 1" }]);

	// Change the quantity to 4
	await entries.row(0).field("quantity").set(4);

	// Check that a new 'Forced' row is created for the extra copy
	await entries.assertRows([
		{ isbn, quantity: 3, warehouseName: "Warehouse 1" },
		{ isbn, quantity: 1, warehouseName: "" }
	]);
});

test("reassigning warehouse with insufficient stock should split the transaction", async ({ page }) => {
	// Setup: Create two warehouses with different stock levels for the same book
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn, quantity: 2, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Add a transaction for 3 copies to the current outbound note, assigned to
	// Warehouse 1
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn, quantity: 3, warehouseId: 1 }] as const);

	const content = getDashboard(page).content();
	const entries = content.table("outbound-note");

	// Wait for the initial state
	await entries.assertRows([{ isbn, quantity: 3, warehouseName: "Warehouse 1" }]);

	// Change the warehouse to Warehouse 2, which has insufficient stock
	await entries.row(0).field("warehouseName").set("Warehouse 2");

	// Check that the transaction was split into two rows
	await entries.assertRows([
		{ isbn, quantity: 2, warehouseName: "Warehouse 2" },
		{ isbn, quantity: 1, warehouseName: "" }
	]);
});

test("should allow forcing a withdrawal for a book with no stock", async ({ page }) => {
	// Setup: Create a warehouse but add no stock for the book
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });

	const content = getDashboard(page).content();
	const scanField = content.scanField();
	const entries = content.table("outbound-note");

	// Add a transaction for the book
	await scanField.add(isbn);

	// The transaction should exist with no warehouse
	await entries.assertRows([{ isbn, quantity: 1, warehouseName: "" }]);

	// Open the warehouse selector dropdown
	await entries.row(0).field("warehouseName").click();

	// The "Force Withdrawal" button should be visible in the dropdown
	const dropdown = page.getByTestId("dropdown-menu");
	await expect(dropdown.locator("button", { hasText: "Force withdrawal" })).toBeVisible();

	// Click the "Force Withdrawal" button
	await dropdown.locator("button", { hasText: "Force withdrawal" }).click();

	// A dialog should appear. Select the warehouse and confirm.
	const forceWithdrawalDialog = page.getByRole("dialog");
	await forceWithdrawalDialog.locator("#warehouse-force-withdrawal").selectOption({
		label: "Warehouse 1"
	});
	await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

	// Assert that the transaction is now a 'Forced' withdrawal from Warehouse 1
	await entries.assertRows([{ isbn, quantity: 1, warehouseName: "Warehouse 1" }]);
	await expect(content.table("outbound-note").row(0).field("warehouseName")).toContainText("Forced");
});

test("should merge forced transaction when stock becomes available", async ({ page }) => {
	// Setup: Create a warehouse with 2 copies of a book
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Add a transaction for the 2 available copies
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn, quantity: 2, warehouseId: 1 }] as const);

	const content = getDashboard(page).content();
	const entries = content.table("outbound-note");
	const scanField = content.scanField();

	// Add one more copy and forcibly assign it to the same warehouse
	await scanField.add(isbn);
	await entries.assertRows([
		{ isbn, quantity: 1, warehouseName: "Warehouse 1" },
		{ isbn, quantity: 2, warehouseName: "" }
	]);

	await entries.row(0).field("warehouseName").click();
	const dropdown = page.getByTestId("dropdown-menu");
	await dropdown.locator("button", { hasText: "Force withdrawal" }).click();
	const forceWithdrawalDialog = page.getByRole("dialog");
	await forceWithdrawalDialog.locator("#warehouse-force-withdrawal").selectOption({
		label: "Warehouse 1"
	});
	await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

	// Check that we have one normal and one forced transaction
	await expect(content.table("outbound-note").row(1).field("warehouseName")).toContainText("Forced");

	await entries.assertRows([
		{ isbn, quantity: 2, warehouseName: "Warehouse 1" },
		{ isbn, quantity: 1, warehouseName: "Warehouse 1" }
	]);

	// Decrease the quantity of the normal transaction, freeing up stock
	await entries.row(0).field("quantity").set(1);

	// Check that the two rows have merged into a single normal transaction
	await entries.assertRows([{ isbn, quantity: 2, warehouseName: "Warehouse 1" }]);
});

test("splitting a forced transaction by assigning to a warehouse with insufficient stock", async ({ page }) => {
	// Setup: Create a warehouse with 2 copies of a book
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Add a transaction for 5 copies to the current outbound note
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn, quantity: 5 }] as const);

	const content = getDashboard(page).content();
	const entries = content.table("outbound-note");

	// Wait for the initial state
	await entries.assertRows([{ isbn, quantity: 5, warehouseName: "" }]);

	// Assign the transaction to Warehouse 1, which has insufficient stock
	await entries.row(0).field("warehouseName").set("Warehouse 1");

	// Check that the transaction was split into a 'Normal' and a 'Forced' row
	await entries.assertRows([
		{ isbn, quantity: 2, warehouseName: "Warehouse 1" },
		{ isbn, quantity: 3, warehouseName: "Warehouse 1" }
	]);
	await expect(content.table("outbound-note").row(1).field("warehouseName")).toContainText("Forced");
});

test("reassigning normal and forced transactions to a warehouse with sufficient stock should merge them", async ({ page }) => {
	// Setup: Create two warehouses with different stock levels
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	// Warehouse 1 has 2 copies
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Warehouse 2 has 3 copies
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn, quantity: 3, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Add a transaction for 3 copies and assign to Warehouse 1 to create a split
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn, quantity: 3, warehouseId: 1 }] as const);

	const entries = getDashboard(page).content().table("outbound-note");

	// Initial state: one normal (2 copies) and one forced (1 copy) transaction
	// for Warehouse 1
	await entries.assertRows([
		{ isbn, quantity: 2, warehouseName: "Warehouse 1" },
		{ isbn, quantity: 1, warehouseName: "Warehouse 1" }
	]);
	await expect(entries.row(1).field("warehouseName")).toContainText("Forced");

	// Reassign the normal transaction to Warehouse 2
	await entries.row(1).field("warehouseName").set("Warehouse 2");

	// Check state after reassigning the normal transaction
	await entries.assertRows([
		{ isbn, quantity: 2, warehouseName: "Warehouse 2" },
		{ isbn, quantity: 1, warehouseName: "Warehouse 1" }
	]);

	// Reassign the forced transaction to Warehouse 2
	await entries.row(1).field("warehouseName").set("Warehouse 2");

	// Check that both transactions merged into a single normal transaction in
	// Warehouse 2
	await entries.assertRows([{ isbn, quantity: 3, warehouseName: "Warehouse 2" }]);
});

test("should auto-assign to the available warehouse after a warehouse with stock has been deleted", async ({ page }) => {
	// Setup: Create multiple warehouses, add stock, and then delete one of the
	// warehouses with stock.
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	// Create warehouses
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(upsertWarehouse, { id: 3, displayName: "Warehouse 3" });

	// Add stock to Warehouse 2 and 3
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 3 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn, quantity: 1, warehouseId: 3 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Delete Warehouse 3, which had stock
	await dbHandle.evaluate(deleteWarehouse, 3);

	// Set Warehouse 1 as the default for the main outbound note (it has no
	// stock)
	await dbHandle.evaluate(updateNote, { id: 1, defaultWarehouse: 1 });

	const content = getDashboard(page).content();
	const scanField = content.scanField();
	const entries = content.table("outbound-note");

	// Add a transaction for the book
	await scanField.add(isbn);

	// Assert that the transaction is automatically assigned to Warehouse 2, as
	// it's the only remaining one with stock.
	await entries.assertRows([{ isbn, quantity: 1, warehouseName: "Warehouse 2" }]);
});

test("should show transaction with no assigned warehouse after the assigned warehouse is deleted", async ({ page }) => {
	// Setup: Create a transaction and assign it to a warehouse.
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	// Add a transaction to the note and assign it to Warehouse 1
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn, quantity: 1, warehouseId: 1 }] as const);

	const entries = getDashboard(page).content().table("outbound-note");

	// Verify initial state: transaction is assigned to Warehouse 1
	await entries.assertRows([{ isbn, quantity: 1, warehouseName: "Warehouse 1" }]);

	// Action: Delete the assigned warehouse.
	await dbHandle.evaluate(deleteWarehouse, 1);

	// Assertion: Verify the transaction row now has no wh
	await entries.assertRows([{ isbn, quantity: 1, warehouseName: "" }]);
});

test("should reset default warehouse selector when the selected warehouse is deleted", async ({ page }) => {
	// Setup: Set a default warehouse for the note.
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(updateNote, { id: 1, defaultWarehouse: 1 });

	const defaultWarehouseSelector = page.locator("#defaultWarehouse");

	// Verify initial state: Warehouse 1 is selected.
	await expect(defaultWarehouseSelector).toHaveValue("1");

	// Action: Delete the assigned default warehouse.
	await dbHandle.evaluate(deleteWarehouse, 1);

	// Assertion: Verify the selector has reset.
	await expect(defaultWarehouseSelector).toHaveValue("");
});

test("should create a transaction with no warehouse if the only warehouse with stock is deleted", async ({ page }) => {
	// Setup: Create two warehouses, add stock to one.
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Action: Delete the warehouse that has stock.
	await dbHandle.evaluate(deleteWarehouse, 2);

	const content = getDashboard(page).content();
	const scanField = content.scanField();
	const entries = content.table("outbound-note");

	// Scan the book.
	await scanField.add(isbn);

	// Assertion: Verify the new transaction has no warehouse assigned.
	await entries.assertRows([{ isbn, quantity: 1, warehouseName: "" }]);
});

test("warehouse dropdown should not show options for deleted warehouses", async ({ page }) => {
	// Setup: Create two warehouses and add stock for a book to both.
	const dbHandle = await getDbHandle(page);
	const isbn = "1234567890";
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });

	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn, quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn, quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	// Add a transaction for the book.
	const content = getDashboard(page).content();
	await content.scanField().add(isbn);

	// Delete one of the warehouses.
	await dbHandle.evaluate(deleteWarehouse, 2);

	const entries = content.table("outbound-note");
	// Open the warehouse selector dropdown.
	await entries.row(0).field("warehouseName").click();

	// Assert that the dropdown only shows the warehouse with available unscanned stock
	const dropdown = page.getByTestId("dropdown-menu");
	// await expect(dropdown.locator("div", { hasText: "Warehouse 1" })).not.toBeVisible();
	// await expect(dropdown.locator("div", { hasText: "Warehouse 2" })).not.toBeVisible();

	// Check for an option that contains the text "Warehouse 1"
	await expect(dropdown.getByRole("option", { name: "Warehouse 1" })).toBeVisible();

	// Check for an option that contains the text "Warehouse 2"
	await expect(dropdown.getByRole("option", { name: "Warehouse 2" })).not.toBeVisible();
});
