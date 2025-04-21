import { test } from "@playwright/test";

import { baseURL } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";
import { addVolumesToNote, createInboundNote, upsertBook, upsertWarehouse } from "@/helpers/cr-sqlite";

import { book1 } from "../data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	// We create a warehouse and a note for all tests
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	await page.getByRole("link", { name: "Manage inventory" }).click();
	await page.getByRole("link", { name: "Inbound" }).click();
});

test("should display correct transaction fields for the inbound-note note view", async ({ page }) => {
	// Setup: Add the book data to the database
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertBook, book1);

	// Navigate to the note page
	// * We repeat this at the start of each test, as tests which do a lot of `dbHandle.evaluate`
	// * calls within the test block can variably end up on `/inventory/inbound` or `/inventory/inbound/1` between firefox and chrome, and this way we can make sure we navigate after
	// await dashboard.content().entityList("inbound-list").item(0).edit();
	//* The following is more reliable on chrome than ^^
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

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
	await row.field("category").assert(book1.category);
});

test("should show empty or \"N/A\" fields and not 'null' or 'undefined' (in case no book data is provided)", async ({ page }) => {
	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

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
	await row.field("price").assert("€0.00");
	await row.field("year").assert("N/A");
	await row.field("publisher").assert("");
	await row.field("editedBy").assert("");
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();
	await row.field("outOfPrint").assert(false);
	await row.field("category").assert("");
});

test("should add a transaction to the note by 'typing the ISBN into the 'Scan' field and pressing \"Enter\" (the same way scenner interaction would be processed)", async ({
	page
}) => {
	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

	const content = getDashboard(page).content();

	// Open the book form with the isbn added to the form using the 'Scan' field
	await content.scanField().add("1234567890");

	// Check updates in the entries table
	await content.table("inbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test("should aggregate the quantity for the same isbn", async ({ page }) => {
	// Setup: Add two transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 1, warehouseId: 1 }] as const);

	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

	const scanField = getDashboard(page).content().scanField();
	const entries = getDashboard(page).content().table("inbound-note");

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

	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

	const content = getDashboard(page).content();

	// Add book 1 again (this time using only isbn and 'Add' button)
	await content.scanField().add(book1.isbn);

	// Check that the new note contains the full book data in the transaction
	await content.table("inbound-note").row(0).assertFields(book1);
});

test("should allow for changing of transaction quantity using the quantity field", async ({ page }) => {
	// Setup: Add one transaction to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);

	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

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
		{ isbn: "1234567891", quantity: 1 },
		{ isbn: "1234567890", quantity: 3 }
	]);
});

test("should sort in reverse order to being added/aggregated", async ({ page }) => {
	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

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

test("should delete the transaction from the note on delete button click", async ({ page }) => {
	// Setup: Add three transactions to the note
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567892", quantity: 1, warehouseId: 1 }] as const);

	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

	const entries = getDashboard(page).content().table("inbound-note");

	// Wait for all the entries to be displayed before selection/deletion (to reduce flakiness)
	await entries.assertRows([{ isbn: "1234567892" }, { isbn: "1234567891" }, { isbn: "1234567890" }]);

	// Delete the second transaction
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await entries.row(1).getByRole("button").click();
	await page.getByTestId("delete-row").click();

	// Check that the second transaction was deleted
	await entries.assertRows([{ isbn: "1234567892" }, { isbn: "1234567890" }]);
});

test("should display book count for all book quantities in the commit message", async ({ page }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 5, warehouseId: 1 }] as const);

	// Navigate to the note page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Edit" }).first().click();
	await page.waitForURL("**/inventory/inbound/1/");

	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Wait for the books to appear
	await page.getByText("1234567890").waitFor();
	await page.getByText("1111111111").waitFor();

	await content.getByRole("button", { name: "Commit" }).click();

	await page.getByRole("dialog").waitFor();
	await page.getByRole("dialog").getByText(`8 books will be added to`).waitFor();
});
