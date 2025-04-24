import { baseURL } from "@/constants";

import { testBase as test } from "@/helpers/fixtures";
import { getDashboard, getDbHandle } from "@/helpers";
import { addVolumesToNote, commitNote, createInboundNote, upsertBook, upsertWarehouse } from "@/helpers/cr-sqlite";

import { book1 } from "@/integration/data";

test.beforeEach(async ({ page }) => {
	await page.waitForTimeout(1000);
	// Load the app
	await page.goto(baseURL);
	await page.waitForTimeout(1000);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the inventory page
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await dashboard.content().entityList("warehouse-list").waitFor();
});

test('should create a new warehouse, on "New warehouse" and redirect to it', async ({ page }) => {
	// page.on("console", (msg) => {
	// 	console.log(`[browser] ${msg.type()}: ${msg.text()}`);
	// });

	// // Capture unhandled exceptions on the page
	// page.on("pageerror", (err) => {
	// 	console.log("[browser pageerror]", err);
	// });

	const dashboard = getDashboard(page);

	// Create a new warehouse
	await dashboard.view("inventory").waitFor();
	await dashboard.getByRole("button", { name: "New warehouse" }).first().click();

	await page.waitForTimeout(2000);

	// Check that we've been redirected to the new warehouse's page
	await dashboard.view("warehouse").waitFor();
	await page.getByRole("main").getByRole("heading", { name: "New Warehouse" });
});

test("should delete the warehouse on delete button click (after confirming the prompt)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	await content.entityList("warehouse-list").waitFor();

	// Create two warehouses to work with
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });

	// Wait for the warehouses to appear
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }]);

	// Delete the first warehouse
	await content.entityList("warehouse-list").item(0).dropdown().delete();

	const dialog = dashboard.dialog();

	// The dialog should display the warehouse name to type in as confirmation
	await dialog.getByLabel("Confirm by typing warehouse name").waitFor();
	await dialog.confirm();

	// The dialog should not have been close (nor warehouse deleted) without name input as confirmation
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }]);

	// Type in the wrong text (the dialog should not close nor warehouse be deleted)
	await dialog.getByLabel("Confirm by typing warehouse name").fill("wrong name");
	await dialog.confirm();
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }]);

	// Type in the correct confirmation name and complete the deletion
	await dialog.getByLabel("Confirm by typing warehouse name").fill("warehouse_1");
	await dialog.confirm();

	await dialog.waitFor({ state: "detached" });
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 2" }]);
});

test("warehouse page: should display breadcrumbs leading back to warehouse page", async ({ page }) => {
	const dashboard = getDashboard(page);

	const header = dashboard.content().header();

	await dashboard.getByRole("button", { name: "New warehouse" }).first().click();
	await header.breadcrumbs().waitFor();

	await header.breadcrumbs().assert(["Warehouses", "New Warehouse"]);

	await header.breadcrumbs().getByText("Warehouses").click();

	await dashboard.view("inventory").waitFor();
	await dashboard.content().entityList("warehouse-list").waitFor();
});

test("should assign default name to warehouses in sequential order", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const header = dashboard.content().header();

	// First warehouse
	await dashboard.getByRole("button", { name: "New warehouse" }).first().click();
	await header.title().assert("New Warehouse");

	await page.getByRole("link", { name: "Manage inventory" }).click();

	// Second warehouse
	await dashboard.getByRole("button", { name: "New warehouse" }).first().click();
	await header.title().assert("New Warehouse (2)");

	// Should display created warehouses in the warehouse list (on inventory page)
	await page.getByRole("link", { name: "Manage inventory" }).click();

	const entityList = content.entityList("warehouse-list");

	await entityList.waitFor();

	await entityList.assertElements([
		{ name: "New Warehouse", numBooks: 0 },
		{ name: "New Warehouse (2)", numBooks: 0 }
	]);
});

test("should continue the naming sequence from the highest sequenced warehouse name (even if lower sequenced warehouses have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const header = dashboard.content().header();
	const warehouseList = content.entityList("warehouse-list");

	const dbHandle = await getDbHandle(page);

	// Create two warehouses with default names
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "New Warehouse" });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "New Warehouse (2)" });

	// Create a new warehouse, continuing the naming sequence
	await dashboard.getByRole("button", { name: "New warehouse" }).first().click();
	await header.title().assert("New Warehouse (3)");

	// Rename the first two warehouses
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });

	// Create another warehouse
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await dashboard.getByRole("button", { name: "New warehouse" }).first().click();
	await header.title().assert("New Warehouse (4)");

	// Verify warehouse names
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await warehouseList.assertElements([
		{ name: "Warehouse 1" },
		{ name: "Warehouse 2" },
		{ name: "New Warehouse (3)" },
		{ name: "New Warehouse (4)" }
	]);

	// Rename remaining warehouses to restart the sequence
	await dbHandle.evaluate(upsertWarehouse, { id: 3, displayName: "Warehouse 3" });
	await dbHandle.evaluate(upsertWarehouse, { id: 4, displayName: "Warehouse 4" });

	// Create a final warehouse with reset sequence
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await dashboard.getByRole("button", { name: "New warehouse" }).first().click();
	await header.title().assert("New Warehouse");

	// Verify final warehouse names
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await warehouseList.assertElements([
		{ name: "Warehouse 1" },
		{ name: "Warehouse 2" },
		{ name: "Warehouse 3" },
		{ name: "Warehouse 4" },
		{ name: "New Warehouse" }
	]);
});

test("should navigate to warehouse page on 'View stock' button click", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two warehouses to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }]);

	// Navigate to first warehouse
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();

	// Check title
	await dashboard.view("warehouse").waitFor();
	await page.getByRole("main").getByRole("heading", { name: "Warehouse 1" });

	// Navigate back to inventory page and to second warehouse
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await content.entityList("warehouse-list").item(1).dropdown().viewStock();

	// Check title
	await dashboard.view("warehouse").waitFor();
	await content.header().title().assert("Warehouse 2");
});

test("should display book count and warehouse discount for each respective warehouse in the list", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create two warehouses for display
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });

	// Both should display 0 books
	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 0 },
		{ name: "Warehouse 2", numBooks: 0 }
	]);

	// Add two books to first warehouse
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 2 },
		{ name: "Warehouse 2", numBooks: 0 }
	]);

	// Add books to second warehouse
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "2222222222", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "3333333333", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "4444444444", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 2 },
		{ name: "Warehouse 2", numBooks: 3 }
	]);

	// Add discounts to warehouses
	await dbHandle.evaluate(upsertWarehouse, { id: 1, discount: 10 });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, discount: 20 });

	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 2, discount: 10 },
		{ name: "Warehouse 2", numBooks: 3, discount: 20 }
	]);
});

test("should update the warehouse using the 'Edit' dialog", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create a warehouse to work with
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1", discount: 10 });
	// Add some books to the warehouse as additional noise (to keep consistent)
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1", numBooks: 2, discount: 10 }]);

	// Update the warehouse using the edit dialog
	await content.entityList("warehouse-list").item(0).dropdown().edit();

	const dialog = dashboard.dialog();
	await dialog.waitFor();

	// Edit warehouse name
	const nameInput = dialog.getByRole("textbox", { name: "name" });
	await nameInput.fill("Warehouse (edited)");

	// Update discount
	const discountInput = dialog.getByRole("spinbutton", { name: "discount" });
	await discountInput.fill("15");

	// Save
	await dialog.getByRole("button", { name: "Save" }).click();
	await dialog.waitFor({ state: "detached" });

	// Check that the warehouse has been updated
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse (edited)", numBooks: 2, discount: 15 }]);
});

test("should display book original price and discounted price as well as the warehouse discount percentage", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create a basic warehouse with 10% discount
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1", discount: 10 });

	// Create a new book with price
	await dbHandle.evaluate(upsertBook, book1);

	// Add book to warehouse
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	// Navigate to the warehouse page
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();

	// Select first row and assert isbn and price
	await content
		.table("warehouse")
		.assertRows([{ isbn: "1234567890", price: { price: "(€12.00)", discountedPrice: "€10.80", discount: "-10%" } }]);
});

test("should progressively load entries until all are shown", async ({ page }) => {
	const entries = Array(100)
		.fill(null)
		.map((_, i) => ({ isbn: i.toString(10).padStart(10, "0"), quantity: 1, warehouseId: 1 }));

	// Setup: create a warehouse and add a bunch of entries
	const db = await getDbHandle(page);
	await db.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await db.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	// TODO: replace this with a batched op
	for (const e of entries) {
		await db.evaluate(addVolumesToNote, [1, e] as const);
	}
	await db.evaluate(commitNote, 1);

	const dashboard = getDashboard(page);
	const table = dashboard.content().table("warehouse");

	// Navigate to warehouse page and expect to see all of the entries
	await dashboard.content().entityList("warehouse-list").item(0).dropdown().viewStock();

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

// TODO: Test renaming using the editable title
