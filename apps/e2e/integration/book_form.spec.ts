import { baseURL } from "../constants";

import { testBase as test } from "@/helpers/fixtures";
import { getDashboard, getDbHandle } from "@/helpers";
import { upsertWarehouse, createInboundNote, createOutboundNote, addVolumesToNote, commitNote } from "@/helpers/cr-sqlite";

import { book1 } from "./data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);
	await getDashboard(page).waitFor();
});

test("update is reflected in table view - stock", async ({ page }) => {
	const dbHandle = await getDbHandle(page);

	// Setup
	//
	// Create the warehouse containing a certain book in stock
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);
	// await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Wait for the app to become responsive
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await page.waitForURL("**/inventory/warehouses/");

	// Navigate to the warehouse page
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await page.getByRole("heading", { name: "Warehouse 1" }).waitFor();
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 1 }], { strict: true });

	// Edit the book data for the first (and only) row
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await content.table("warehouse").row(0).getByRole("button").click();
	await page.getByTestId("edit-row").click();

	const bookForm = dashboard.bookForm();
	await bookForm.fillData(book1);
	await bookForm.submit("click");

	// The row should have been updated
	await content.table("warehouse").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});

test("update is reflected in table view - inbound", async ({ page }) => {
	// Setup
	//
	// Create a warehouse and a note containing a certain book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Wait for the app to become responsive
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await page.getByRole("link", { name: "Purchase" }).click();
	await page.waitForURL("**/inventory/inbound/");

	// Navigate to the note page
	await content.entityList("inbound-list").item(0).edit();
	await page.getByRole("heading", { name: "Note 1" }).first().waitFor();
	await content.table("inbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }], { strict: true });

	// Edit the book data for the first (and only) row
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await content.table("inbound-note").row(0).getByRole("button").click();
	await page.getByTestId("edit-row").click();

	const bookForm = dashboard.bookForm();
	await bookForm.fillData(book1);
	await bookForm.submit("click");

	// The row should have been updated
	await content.table("inbound-note").assertRows([{ ...book1, quantity: 1 }], { strict: true });
});

test("update is reflected in table view - outbound", async ({ page }) => {
	// Setup
	//
	// Create a note containing a certain book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1 }] as const);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Wait for the app to become responsive
	await page.getByRole("link", { name: "Sale" }).click();
	await page.waitForURL("**/outbound/");

	// Navigate to the note page
	await content.entityList("outbound-list").item(0).edit();
	await page.getByRole("heading", { name: "Note 1" }).first().waitFor();
	await content.table("outbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }]);
	// assert that warehousename field has forced type
	//

	// Edit the book data for the first (and only) row
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await content.table("outbound-note").row(0).getByRole("button").click();
	await page.getByTestId("edit-row").click();

	const bookForm = dashboard.bookForm();
	await bookForm.fillData(book1);
	await bookForm.submit("click");

	// The row should have been updated
	await content.table("outbound-note").assertRows([{ ...book1, quantity: 1 }]);
});

test("book form can be submitted using keyboard", async ({ page }) => {
	// Setup
	//
	// Create a note containing a certain book in stock
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1 }] as const);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Wait for the app to become responsive
	await page.getByRole("link", { name: "Sale" }).click();
	await page.waitForURL("**/outbound/");

	// Navigate to the note page
	await content.entityList("outbound-list").item(0).edit();
	await page.getByRole("heading", { name: "Note 1" }).first().waitFor();
	await content.table("outbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }]);

	// Edit the book data for the first (and only) row
	// TODO: quick fix for a failing step. Both buttons should be identifiable by accessible label
	await content.table("outbound-note").row(0).getByRole("button").click();
	await page.getByTestId("edit-row").click();

	const bookForm = dashboard.bookForm();
	await bookForm.fillData(book1);
	await bookForm.submit("keyboard");

	// The row should have been updated
	await content.table("outbound-note").assertRows([{ ...book1, quantity: 1 }]);
});
