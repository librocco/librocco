import { expect } from "@playwright/test";

import { baseURL } from "../constants";

import { testBase as test } from "@/helpers/fixtures";
import { getDashboard, getDbHandle } from "@/helpers";

import { addVolumesToNote, commitNote, createInboundNote, createOutboundNote, upsertWarehouse } from "@/helpers/cr-sqlite";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	// We're creating one warehouse (for each test) and are using its stock view as default view
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });

	// Navigate to warehouse-list view and wait for the page to load
	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the stock/search page
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await dashboard.content().entityList("warehouse-list").waitFor();
});

test("should update the stock when the inbound note is committed", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Test Note" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 3, warehouseId: 1 }] as const);

	// Navigate to the warehouse page
	// * We repeat this at the start of each test, as tests which do a lot of `dbHandle.evaluate`
	// * calls within the test block can variably end up on `/inventory/warehouses/` or `/inventory/warehouses/1` between firefox and chrome, and this way we can make sure we navigate after
	await page.getByRole("link", { name: "Warehouse 1" }).click();
	await page.waitForURL("**/warehouses/1/");

	// Initial view: Warehouse 1 stock page

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// No table should be shown for "Warehouse 1"
	await content.table("warehouse").waitFor({ state: "detached" });

	// Navigate to "Test Note" page and commit the note
	await content.header().breadcrumbs().getByText("Warehouses").click();
	await dashboard.view("inventory").waitFor();
	await page.getByRole("link", { name: "Purchase" }).click();
	await content.entityList("inbound-list").item(0).edit();
	await dashboard.view("inbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	// Committed transactions should be reflected in "Warehouse 1" stock
	//
	// After committing, we've been redirected to the inbound list view
	// Navigate to warehouse page (through warehouse list)
	await page.getByRole("link", { name: "Warehouses", exact: true }).click();
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.header().title().assert("Warehouse 1");
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 2 },
		{ isbn: "1234567891", quantity: 3 }
	]);
});

test("should aggrgate the transactions of the same isbn and warehouse (in stock) when the inbound note is committed", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	// ai - the inbound note transactions should also have a warehouseId specified (same as the note warehouseId)
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1, displayName: "Test Note" });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567891", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567893", quantity: 1, warehouseId: 1 }] as const);

	// Navigate to the warehouse page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Warehouse 1" }).click();
	await page.waitForURL("**/warehouses/1/");

	// Initial view: Warehouse 1 stock page

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Check the stock before committing the (second) note
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 2 },
		{ isbn: "1234567891", quantity: 3 }
	]);

	// Navigate to "Test Note" page and commit the note
	await content.header().breadcrumbs().getByText("Warehouses").click();
	await dashboard.view("inventory").waitFor();
	await page.getByRole("link", { name: "Purchase" }).click();
	await content.entityList("inbound-list").item(0).edit();
	await dashboard.view("inbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	await expect(page.getByRole("dialog")).not.toBeVisible();

	// Committed transactions should be aggregated in "Warehouse 1" stock
	//
	// After committing, we've been redirected to the inbound list view
	// Navigate to warehouse page (through warehouse list)
	await page.getByRole("link", { name: "Warehouses", exact: true }).click();

	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.header().title().assert("Warehouse 1");
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 2 },
		{ isbn: "1234567891", quantity: 5 },
		{ isbn: "1234567893", quantity: 1 }
	]);
});

test('warehouse stock page should show only the stock for a praticular warehouse, "All" should show all', async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567891", quantity: 3, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Navigate to the warehouse page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Warehouse 1" }).click();
	await page.waitForURL("**/warehouses/1/");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 2 }]);

	// Navigate to "Warehouse 2" and check stock
	await content.header().breadcrumbs().getByText("Warehouses").click();

	await expect(content.getByTestId("spinner")).toBeHidden();
	await content.entityList("warehouse-list").waitFor({ state: "visible" });
	// Check "Warehouse 1" stock view

	await content.entityList("warehouse-list").item(1).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567891", quantity: 3 }]);
});

test("committing an outbound note should decrement the stock by the quantities in its transactions", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 5, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567892", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Test Note" });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567891", quantity: 3, warehouseId: 1 }] as const);

	// Navigate to the warehouse page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Warehouse 1" }).click();
	await page.waitForURL("**/warehouses/1/");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	// Check stock before committing the note
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 3 },
		{ isbn: "1234567891", quantity: 5 },
		{ isbn: "1234567892", quantity: 2 }
	]);

	// Navigate to the note and commit it
	await page.getByRole("link", { name: "Sale" }).click();
	await content.entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	// Navigate back to "Warehouse 1" page and check the updated stock
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await expect(content.getByTestId("spinner")).toBeHidden();
	await content.entityList("warehouse-list").waitFor({ state: "visible" });

	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 1 },
		{ isbn: "1234567891", quantity: 2 },
		{ isbn: "1234567892", quantity: 2 }
	]);
});

test("should remove 0 quantity stock entries from the stock", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567891", quantity: 5, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Test Note" });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 3, warehouseId: 1 }] as const);

	// Navigate to the warehouse page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Warehouse 1" }).click();
	await page.waitForURL("**/warehouses/1/");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	//  Check the stock before committing the note
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 3 },
		{ isbn: "1234567891", quantity: 5 }
	]);

	// Commit the outbound note
	await page.getByRole("link", { name: "Sale" }).click();
	await content.entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	//  Check the updated stock
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await expect(content.getByTestId("spinner")).toBeHidden();
	await content.entityList("warehouse-list").waitFor({ state: "visible" });

	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567891", quantity: 5 }]);
});

test("committing an outbound note with transactions in two warehouses should decrement the stock in both", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1 });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 2 });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1234567890", quantity: 3, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	await dbHandle.evaluate(createOutboundNote, { id: 3, displayName: "Test Note" });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "1234567890", quantity: 1, warehouseId: 2 }] as const);

	// Navigate to the warehouse page
	// * See note on first test about why this is repeated
	await page.getByRole("link", { name: "Warehouse 1" }).click();
	await page.waitForURL("**/warehouses/1/");

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	// Check the stock before committing the note
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 2 }]);

	// Navigate to the note and commit it
	await page.getByRole("link", { name: "Sale" }).click();
	await content.entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	// Check the updated stock - warehouse 1
	await page.getByRole("link", { name: "Manage inventory" }).click();

	await expect(content.getByTestId("spinner")).toBeHidden();
	await content.entityList("warehouse-list").waitFor({ state: "visible" });

	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 1 }]);

	// Check the updated stock - warehouse 2
	await content.header().breadcrumbs().getByText("Warehouses").click();

	await expect(content.getByTestId("spinner")).toBeHidden();
	await content.entityList("warehouse-list").waitFor({ state: "visible" });

	await content.entityList("warehouse-list").item(1).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 2 }]);
});
