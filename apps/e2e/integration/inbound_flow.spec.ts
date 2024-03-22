import { test } from "@playwright/test";

import { baseURL } from "./constants";
import { assertionTimeout } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";
import { book1 } from "@/integration/data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the inventory page
	await dashboard.navigate("inventory");

	// Wait for the view to load (warehouse list is the default sub-view)
	const warehouseList = dashboard.content().entityList("warehouse-list");
	await warehouseList.waitFor();

	// Create a warehouse to work with (as all inbound notes are namespaced to warehouses)
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
	);
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
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-2")
			.create()
			.then((n) => n.setName({}, "Note 2"))
	);

	// Navigate to inbound list
	await content.navigate("inbound-list");

	// The notes should appear in the list
	await inNoteList.assertElements([{ name: "Warehouse 1 / Note 1" }, { name: "Warehouse 1 / Note 2" }]);

	// Add another warehouse and a note to it
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"))
			.then((w) => w.note("note-3").create())
			.then((n) => n.setName({}, "Note 3"))
	);

	// All notes should be namespaced to their respective warehouses
	await inNoteList.assertElements([{ name: "Warehouse 1 / Note 1" }, { name: "Warehouse 1 / Note 2" }, { name: "Warehouse 2 / Note 3" }]);
});

test("should delete the note on delete button click (after confirming the prompt)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two notes to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-2")
			.create()
			.then((n) => n.setName({}, "Note 2"))
	);

	// Wait for the notes to appear
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 1" }, { name: "Warehouse 1 / Note 2" }]);

	// Delete the first note
	await content.entityList("inbound-list").item(0).delete();
	await dashboard.dialog().confirm();

	// Check that the note has been deleted
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 2" }]);
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
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"))
	);

	// First note (Warehouse 1)
	await warehouseList.item(0).createNote();
	await header.title().assert("New Note");
	const note1UpdatedAt = await header.updatedAt().value();

	await dashboard.navigate("inventory");

	// Second note (Warehouse 1)
	await warehouseList.item(0).createNote();
	await header.title().assert("New Note (2)");
	const note2UpdatedAt = await header.updatedAt().value();

	await dashboard.navigate("inventory");

	// Third note (Warehouse 2)
	await warehouseList.item(1).createNote();
	await header.title().assert("New Note (3)");
	const note3UpdatedAt = await header.updatedAt().value();

	await dashboard.navigate("inventory");
	await content.navigate("inbound-list");
	const entityList = content.entityList("inbound-list");

	await entityList.assertElements([
		{ name: "Warehouse 1 / New Note", numBooks: 0, updatedAt: note1UpdatedAt },
		{ name: "Warehouse 1 / New Note (2)", numBooks: 0, updatedAt: note2UpdatedAt },
		{ name: "Warehouse 2 / New Note (3)", numBooks: 0, updatedAt: note3UpdatedAt }
	]);
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Navigate to inbound list
	await content.navigate("inbound-list");

	// Create three notes (default names: "New Note", "New Note (2)", "New Note (3)")
	// We're using the same warehosue as we've verified that the warehouse doesn't affect the naming sequence (in the previous test)
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").note("note-1").create());
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").note("note-2").create());
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").note("note-3").create());

	// Rename the first two notes (leaving us with only "New Note (3)", having the default name)
	await dbHandle.evaluate((db) =>
		Promise.all([
			db.warehouse("warehouse-1").note("note-1").setName({}, "Note 1"),
			db.warehouse("warehouse-1").note("note-2").setName({}, "Note 2")
		])
	);

	// Check names
	await content
		.entityList("inbound-list")
		.assertElements([{ name: "Warehouse 1 / Note 1" }, { name: "Warehouse 1 / Note 2" }, { name: "Warehouse 1 / New Note (3)" }]);

	// TODO: the following should be refactored to use the dashboard (when the renaming functionality is in).
	// For now we're using the db directly (not really e2e way).
	//
	// Create a new note (should continue the sequence)
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").note("note-4").create());
	await content
		.entityList("inbound-list")
		.assertElements([
			{ name: "Warehouse 1 / Note 1" },
			{ name: "Warehouse 1 / Note 2" },
			{ name: "Warehouse 1 / New Note (3)" },
			{ name: "Warehouse 1 / New Note (4)" }
		]);

	// Rename the remaining notes with default names
	await dbHandle.evaluate((db) =>
		Promise.all([
			db.warehouse("warehouse-1").note("note-3").setName({}, "Note 3"),
			db.warehouse("warehouse-1").note("note-4").setName({}, "Note 4")
		])
	);
	await content
		.entityList("inbound-list")
		.assertElements([
			{ name: "Warehouse 1 / Note 1" },
			{ name: "Warehouse 1 / Note 2" },
			{ name: "Warehouse 1 / Note 3" },
			{ name: "Warehouse 1 / Note 4" }
		]);

	// Create a new note (should reset the sequence)
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").note("note-5").create());
	await content
		.entityList("inbound-list")
		.assertElements([
			{ name: "Warehouse 1 / Note 1" },
			{ name: "Warehouse 1 / Note 2" },
			{ name: "Warehouse 1 / Note 3" },
			{ name: "Warehouse 1 / Note 4" },
			{ name: "Warehouse 1 / New Note" }
		]);
});

test("should navigate to note page on 'edit' button click", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two notes to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 2"))
	);

	// Naviate to the inbound list
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 1" }, { name: "Warehouse 1 / Note 2" }]);

	// Navigate to first note
	await content.entityList("inbound-list").item(0).edit();

	// Check title
	await dashboard.view("inbound-note").waitFor();
	await content.header().title().assert("Note 1");

	// Navigate back to inbound page and to second note
	await dashboard.navigate("inventory");
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").item(1).edit();

	// Check title
	await dashboard.view("inbound-note").waitFor();
	await content.header().title().assert("Note 2");
});

test("should display book count for each respective note in the list", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create two notes for display
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-2")
			.create()
			.then((n) => n.setName({}, "Note 2"))
	);

	await content.navigate("inbound-list");

	// Both should display 0 books
	await content.entityList("inbound-list").assertElements([
		{ name: "Warehouse 1 / Note 1", numBooks: 0 },
		{ name: "Warehouse 1 / Note 2", numBooks: 0 }
	]);

	// Add two books to first note
	await dbHandle.evaluate((db) =>
		db.warehouse("warehouse-1").note("note-1").addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1111111111", quantity: 1 })
	);

	await content.entityList("inbound-list").assertElements([
		{ name: "Warehouse 1 / Note 1", numBooks: 2 },
		{ name: "Warehouse 1 / Note 2", numBooks: 0 }
	]);

	// Add books to second note
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-2")
			.addVolumes({ isbn: "2222222222", quantity: 1 }, { isbn: "3333333333", quantity: 1 }, { isbn: "4444444444", quantity: 1 })
	);

	await content.entityList("inbound-list").assertElements([
		{ name: "Warehouse 1 / Note 1", numBooks: 2 },
		{ name: "Warehouse 1 / Note 2", numBooks: 3 }
	]);
});

test("should display book original price and discounted price as well as the warehouse discount percentage", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create note for display
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);

	// Set warehouse discount
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").setDiscount({}, 10));

	// Create a new book with price
	await dbHandle.evaluate((db, book) => db.books().upsert([book]), book1);

	// Add book to note
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").note("note-1").addVolumes({ isbn: "1234567890", quantity: 1 }));

	// Navigate to the inbound list
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").assertElements([{ name: "Warehouse 1 / Note 1" }]);

	// Navigate to first note
	await content.entityList("inbound-list").item(0).edit();

	// Select first row and assert isbn and price
	await content
		.table("warehouse")
		.assertRows([{ isbn: "1234567890", price: { price: "(€12.00)", discountedPrice: "€10.80", discount: "-10%" } }]);
});
// TODO: Test renaming using the editable title
