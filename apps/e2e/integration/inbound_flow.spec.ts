import { expect, test } from "@playwright/test";

import { baseURL } from "./constants";
import { assertionTimeout } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";
import { addVolumesToNote, createInboundNote, updateNote, upsertBook, upsertWarehouse } from "@/helpers/cr-sqlite";
import { book1 } from "@/integration/data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the inventory page
	await page.getByRole("link", { name: "Manage inventory" }).click();

	// Wait for the view to load (warehouse list is the default sub-view)
	const warehouseList = dashboard.content().entityList("warehouse-list");
	await warehouseList.waitFor();

	// Create a warehouse to work with (as all inbound notes are namespaced to warehouses)
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await warehouseList.assertElements([{ name: "Warehouse 1" }]);
});

test('should create a new inbound note, under the particular warehouse, on warehouse row -> "New note" click and redirect to it', async ({
	page
}) => {
	const dasbboard = getDashboard(page);

	const content = dasbboard.content();

	// Create a new note under "Warehouse 1"
	await content.entityList("warehouse-list").item(0).getByRole("button", { name: "New note" }).click();

	// Check that we've been redirected to the new note's page
	await dasbboard.view("inbound-note").waitFor();
	await dasbboard.content().header().title().assert("New Note");
});

test("should display notes, namespaced to warehouses, in the inbound note list", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const inNoteList = content.entityList("inbound-list");

	// Add some notes to the first (existing) warehouse
	// Instead of `dbHandle` this test uses `(await getDbHandle(page))` so it works after a page reload
	// const dbHandle = await getDbHandle(page);
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 2, warehouseId: 1, displayName: "Note 2" });

	// Navigate to inbound list
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");

	// The notes should appear in the list
	await inNoteList.assertElements([{ name: "Warehouse 1 / Note 2" }, { name: "Warehouse 1 / Note 1" }]);

	// Add another warehouse and a note to it
	await (await getDbHandle(page)).evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 3, warehouseId: 2, displayName: "Note 3" });

	// All notes should be namespaced to their respective warehouses
	await inNoteList.assertElements([{ name: "Warehouse 2 / Note 3" }, { name: "Warehouse 1 / Note 2" }, { name: "Warehouse 1 / Note 1" }]);
});

test("should delete the note on delete button click (after confirming the prompt)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two notes to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1, displayName: "Note 2" });

	// Wait for the notes to appear
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 2" }, { name: "Warehouse 1 / Note 1" }]);

	// Delete the first note
	await content.entityList("inbound-list").item(0).delete();
	await dashboard.dialog().confirm();

	// Check that the note has been deleted
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 1" }]);
});

test("note heading should display note name, 'updated at' timestamp", async ({ page }) => {
	const dashboard = getDashboard(page);

	const header = dashboard.content().header();

	// Create a note (and wait for redirect)
	await dashboard.content().entityList("warehouse-list").item(0).createNote();

	// Check the title
	await header.title().assert("New Note");

	// Check the 'updated at' timestamp
	const updatedAt = new Date();
	await header.updatedAt().assert(updatedAt, { timeout: assertionTimeout });
});

test("note should display breadcrumbs leading back to inbound page, or the parent warehouse", async ({ page }) => {
	const dashboard = getDashboard(page);
	const header = dashboard.content().header();

	// Create note (and wait for redirect)
	await dashboard.content().entityList("warehouse-list").item(0).createNote();

	await header.breadcrumbs().waitFor();
	await header.breadcrumbs().assert(["Inbound", "Warehouse 1", "New Note"]);

	await header.breadcrumbs().getByText("Inbound").click();

	// Should get redirected to inbound view
	await dashboard.view("inventory").waitFor();
	await dashboard.content().entityList("inbound-list").waitFor();

	// Go back to the node
	await dashboard.content().entityList("inbound-list").item(0).edit();

	// Click to "Warehouse 1" breadcrumb - should redirect to warehouse page
	await header.breadcrumbs().getByText("Warehouse 1").click();

	await dashboard.view("warehouse").waitFor();
	await header.title().assert("Warehouse 1");
});

test("should assign default name to notes in sequential order (regardless of warehouse they belong to)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const header = dashboard.content().header();

	const warehouseList = content.entityList("warehouse-list");

	// Create another warehouse
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2" });

	// First note (Warehouse 1)
	await warehouseList.item(0).createNote();
	await header.title().assert("New Note");
	const note1UpdatedAt = await header.updatedAt().value();

	await page.getByRole("link", { name: "Manage inventory" }).click();

	// Second note (Warehouse 1)
	await warehouseList.item(0).createNote();
	await header.title().assert("New Note (2)");
	const note2UpdatedAt = await header.updatedAt().value();

	await page.getByRole("link", { name: "Manage inventory" }).click();

	// Third note (Warehouse 2)
	await warehouseList.item(1).createNote();
	await header.title().assert("New Note (3)");
	const note3UpdatedAt = await header.updatedAt().value();

	// Should display created notes in the inbound list
	await page.getByRole("link", { name: "Manage inventory" }).click();
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");

	const entityList = content.entityList("inbound-list");

	await entityList.assertElements([
		{ name: "Warehouse 2 / New Note (3)", numBooks: 0, updatedAt: note3UpdatedAt },
		{ name: "Warehouse 1 / New Note (2)", numBooks: 0, updatedAt: note2UpdatedAt },
		{ name: "Warehouse 1 / New Note", numBooks: 0, updatedAt: note1UpdatedAt }
	]);
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const header = dashboard.content().header();
	const warehouseList = dashboard.content().entityList("warehouse-list");

	const dbHandle = await getDbHandle(page);

	// TODO: Create two notes with default names
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "New Note" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1, displayName: "New Note (2)" });

	// Create a new note, continuning the naming sequence
	await warehouseList.item(0).createNote();
	await header.title().assert("New Note (3)");

	await page.getByRole("link", { name: "Manage inventory" }).click();

	// Rename the first two notes (leaving us with only "New Note (3)", having the default name)
	await dbHandle.evaluate(updateNote, { id: 1, displayName: "Note 1" });
	await dbHandle.evaluate(updateNote, { id: 2, displayName: "Note 2" });

	await warehouseList.item(0).createNote();
	await header.title().assert("New Note (4)");

	// Check names
	await page.getByRole("link", { name: "Manage inventory" }).click();
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");
	await content
		.entityList("inbound-list")
		.assertElements([
			{ name: "Warehouse 1 / New Note (4)" },
			{ name: "Warehouse 1 / Note 2" },
			{ name: "Warehouse 1 / Note 1" },
			{ name: "Warehouse 1 / New Note (3)" }
		]);

	// Rename the remaining notes to restart the sequence
	await dbHandle.evaluate(updateNote, { id: 3, displayName: "Note 3" });
	await dbHandle.evaluate(updateNote, { id: 4, displayName: "Note 4" });

	// Create a final note (with reset sequence)
	await content.navigate("warehouse-list");
	await warehouseList.item(0).createNote();
	await header.title().assert("New Note");

	// Check names
	await page.getByRole("link", { name: "Manage inventory" }).click();
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");
	await content
		.entityList("inbound-list")
		.assertElements([
			{ name: "Warehouse 1 / New Note" },
			{ name: "Warehouse 1 / Note 4" },
			{ name: "Warehouse 1 / Note 3" },
			{ name: "Warehouse 1 / Note 2" },
			{ name: "Warehouse 1 / Note 1" }
		]);
});

test("should be able to edit note title", async ({ page }) => {
	const dashboard = getDashboard(page);
	const content = dashboard.content();

	await content.navigate("inbound-list");

	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "New Note" });
	await content.entityList("inbound-list").item(0).edit();
	// Check title
	await dashboard.view("inbound-note").waitFor();
	await content.header().title().assert("New Note");

	await dashboard.textEditableField().fillData("title");
	await dashboard.textEditableField().submit();
	// to make sure title is persisted
	await dashboard.navigate("inventory");
	await content.navigate("inbound-list");
	expect(content.entityList("inbound-list").item(0).getByText("title")).toBeVisible();
});
test("should navigate to note page on 'edit' button click", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two notes to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1, displayName: "Note 2" });

	// Naviate to the inbound list
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 2" }, { name: "Warehouse 1 / Note 1" }]);

	// Navigate to note 1
	await content.entityList("inbound-list").item(1).edit();

	// Check title
	await dashboard.view("inbound-note").waitFor();
	await content.header().title().assert("Note 1");

	// Navigate back to inbound page and to note 2
	await page.getByRole("link", { name: "Manage inventory" }).click();
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").item(0).edit();

	// Check title
	await dashboard.view("inbound-note").waitFor();
	await content.header().title().assert("Note 2");
});

test("should display book count for each respective note in the list", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create two notes for display
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 1, displayName: "Note 2" });

	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");

	// Both should display 0 books
	await content.entityList("inbound-list").assertElements([
		{ name: "Warehouse 1 / Note 2", numBooks: 0 },
		{ name: "Warehouse 1 / Note 1", numBooks: 0 }
	]);

	// Add two books to first note
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);

	await content.entityList("inbound-list").assertElements([
		{ name: "Warehouse 1 / Note 1", numBooks: 2 },
		{ name: "Warehouse 1 / Note 2", numBooks: 0 }
	]);

	// Add books to second note
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "2222222222", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "3333333333", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "4444444444", quantity: 1, warehouseId: 1 }] as const);

	await content.entityList("inbound-list").assertElements([
		{ name: "Warehouse 1 / Note 2", numBooks: 3 },
		{ name: "Warehouse 1 / Note 1", numBooks: 2 }
	]);
});

test("should display book original price and discounted price as well as the warehouse discount percentage", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create note for display
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });

	// Set warehouse discount
	await dbHandle.evaluate(upsertWarehouse, { id: 1, discount: 10 });

	// Create a new book with price
	await dbHandle.evaluate(upsertBook, book1);

	// Add book to note
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);

	// Navigate to the inbound list
	// TODO: should improve accessible markup and target as "role=tab"
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 1" }]);

	// Navigate to first note
	await content.entityList("inbound-list").item(0).edit();

	// Select first row and assert isbn and price
	await content
		.table("warehouse")
		.assertRows([{ isbn: "1234567890", price: { price: "(€12.00)", discountedPrice: "€10.80", discount: "-10%" } }]);
});
