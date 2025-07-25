import { expect } from "@playwright/test";
import { depends, testBase as test, testInventory } from "@/helpers/fixtures";

import { baseURL } from "@/constants";
import { assertionTimeout } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";
import {
	createOutboundNote,
	updateNote,
	addVolumesToNote,
	upsertWarehouse,
	upsertBook,
	createInboundNote,
	commitNote
} from "@/helpers/cr-sqlite";
import { book1 } from "@/integration/data";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the outbound note page
	await page.getByRole("link", { name: "Sale" }).click();
	await page.getByRole("heading", { name: "Outbound" }).first().waitFor();
});

test('should create a new outbound note, on "New sale" and redirect to it', async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	// Create a new note
	await dashboard.content().header().getByRole("button", { name: "New sale" }).first().click();

	// Check that we've been redirected to the new note's page
	await page.getByRole("heading", { name: "New Sale" }).first().waitFor();
});

test("should delete the note on delete button click (after confirming the prompt)", async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const content = dashboard.content();

	// Create two notes to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Sale 1" });
	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Sale 2" });

	// Wait for the notes to appear
	await content.entityList("outbound-list").assertElements([{ name: "Sale 2" }, { name: "Sale 1" }]);

	// Delete the first note
	await content.entityList("outbound-list").item(0).delete();
	await dashboard.dialog().confirm();

	// Check that the note has been deleted
	await content.entityList("outbound-list").assertElements([{ name: "Sale 1" }]);
});

test("note heading should display note name, 'updated at' timestamp", async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const header = dashboard.content().header();

	await dashboard.content().header().getByRole("button", { name: "New sale" }).first().click();

	// Check the title
	await page.getByRole("heading", { name: "New Sale" }).first().waitFor();

	// Check the 'updated at' timestamp
	const updatedAt = new Date();
	await header.updatedAt().assert(updatedAt, { timeout: assertionTimeout });
});

test("note should display breadcrumbs leading back to outbound page", async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const header = dashboard.content().header();

	await dashboard.content().header().getByRole("button", { name: "New sale" }).first().click();

	await header.breadcrumbs().waitFor();

	await header.breadcrumbs().assert(["Outbound", "New Sale"]);

	await header.breadcrumbs().getByText("Outbound").click();

	await dashboard.view("outbound").waitFor();
});

test("should assign default name to notes in sequential order", async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const content = dashboard.content();
	const header = dashboard.content().header();

	// First note
	await dashboard.content().header().getByRole("button", { name: "New sale" }).first().click();

	await page.getByRole("heading", { name: "New Sale" }).first().waitFor();
	const note1UpdatedAt = await header.updatedAt().value();

	await page.getByRole("link", { name: "Outbound" }).first().click(); // In the main nav, not the breadcrumb nav

	// Second note
	await dashboard.content().header().getByRole("button", { name: "New sale" }).first().click();

	await page.getByRole("heading", { name: "New Sale (2)" }).first().waitFor();
	const note2UpdatedAt = await header.updatedAt().value();

	// Should display created notes in the outbound note list
	await page.getByRole("link", { name: "Outbound" }).first().click(); // In the main nav, not the breadcrumb nav

	const entityList = content.entityList("outbound-list");

	await entityList.waitFor();

	await entityList.assertElements([
		{ name: "New Sale (2)", numBooks: 0, updatedAt: note2UpdatedAt },
		{ name: "New Sale", numBooks: 0, updatedAt: note1UpdatedAt }
	]);
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const content = dashboard.content();
	const dbHandle = await getDbHandle(page);

	// Create notes with default names
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "New Sale" });
	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "New Sale (2)" });

	// Create a new note, continuing the naming sequence
	await page.getByRole("button", { name: "New Sale", exact: true }).click();
	await page.getByRole("heading", { name: "New Sale (3)" }).first().waitFor();

	// Verify names
	await page.getByRole("link", { name: "Sale" }).first().click(); // In the main nav, not the breadcrumb nav
	await content.entityList("outbound-list").assertElements([{ name: "New Sale (3)" }, { name: "New Sale (2)" }, { name: "New Sale" }]);

	// Rename the first two notes
	await dbHandle.evaluate(updateNote, { id: 1, displayName: "Sale 1" });
	await dbHandle.evaluate(updateNote, { id: 2, displayName: "Sale 2" });

	// Verify names
	await content.entityList("outbound-list").assertElements([{ name: "Sale 2" }, { name: "Sale 1" }, { name: "New Sale (3)" }]);

	// Create another note, continuing the sequence
	await page.getByRole("button", { name: "New Sale", exact: true }).click();
	await page.getByRole("heading", { name: "New Sale (4)" }).first().waitFor();

	// Verify names
	await page.getByRole("link", { name: "Outbound" }).first().click(); // In the main nav, not the breadcrumb nav
	await content
		.entityList("outbound-list")
		.assertElements([{ name: "New Sale (4)" }, { name: "Sale 2" }, { name: "Sale 1" }, { name: "New Sale (3)" }]);

	// Rename remaining notes to reset the sequence
	await dbHandle.evaluate(updateNote, { id: 3, displayName: "Sale 3" });
	await dbHandle.evaluate(updateNote, { id: 4, displayName: "Sale 4" });
	await content
		.entityList("outbound-list")
		.assertElements([{ name: "Sale 4" }, { name: "Sale 3" }, { name: "Sale 2" }, { name: "Sale 1" }]);

	// Create a final note with reset sequence
	await page.getByRole("button", { name: "New Sale", exact: true }).click();
	await page.getByRole("heading", { name: "New Sale" }).first().waitFor();

	// Verify names
	await page.getByRole("link", { name: "Outbound" }).first().click(); // In the main nav, not the breadcrumb nav
	await content
		.entityList("outbound-list")
		.assertElements([{ name: "New Sale" }, { name: "Sale 4" }, { name: "Sale 3" }, { name: "Sale 2" }, { name: "Sale 1" }]);
});

test("should navigate to note page on 'edit' button click", async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const content = dashboard.content();
	const dbHandle = await getDbHandle(page);

	// Create two notes to work with
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Sale 1" });
	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Sale 2" });

	await content.entityList("outbound-list").assertElements([{ name: "Sale 2" }, { name: "Sale 1" }]);

	// Navigate to note 1
	await content.entityList("outbound-list").item(1).edit();

	// Check title
	await dashboard.view("outbound-note").waitFor();
	await page.getByRole("heading", { name: "Sale 1" }).first().waitFor();

	// Navigate back to outbound page and to note 2
	await page.getByRole("link", { name: "Sale" }).first().click(); // In the main nav, not the breadcrumb nav
	await content.entityList("outbound-list").item(0).edit();

	// Check title
	await dashboard.view("outbound-note").waitFor();
	await page.getByRole("heading", { name: "Sale 2" }).first().waitFor();
});

test("should display book count for each respective note in the list", async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create two notes for display
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Sale 1" });
	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Sale 2" });

	// Both should display 0 books
	await content.entityList("outbound-list").assertElements([
		{ name: "Sale 2", numBooks: 0 },
		{ name: "Sale 1", numBooks: 0 }
	]);

	// Add two books to first note
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 1 }] as const);

	await content.entityList("outbound-list").assertElements([
		{ name: "Sale 1", numBooks: 2 },
		{ name: "Sale 2", numBooks: 0 }
	]);

	// Add books to second note
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "2222222222", quantity: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "3333333333", quantity: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "4444444444", quantity: 1 }] as const);

	await content.entityList("outbound-list").assertElements([
		{ name: "Sale 2", numBooks: 3 },
		{ name: "Sale 1", numBooks: 2 }
	]);
});

test("should display book original price and discounted price as well as the warehouse discount percentage", async ({ page }) => {
	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale" }).click();

	const content = dashboard.content();
	const dbHandle = await getDbHandle(page);

	// Create warehouse with discount
	await dbHandle.evaluate(upsertWarehouse, { id: 1, discount: 10 });

	// Create a new book with price
	await dbHandle.evaluate(upsertBook, book1);

	// Create an outbound note
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Sale 1" });

	// Add book to note
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1, warehouseId: 1 }] as const);

	// Navigate to first note
	await content.entityList("outbound-list").item(0).edit();

	// Select first row and assert isbn and price
	await dashboard.view("outbound-note").waitFor();
	await content
		.table("warehouse")
		.assertRows([{ isbn: "1234567890", price: { price: "(€12.00)", discountedPrice: "€10.80", discount: "-10%" } }]);
});

test("should be able to edit note title", async ({ page }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(createOutboundNote, { id: 1, warehouseId: 1, displayName: "New Sale" });

	const dashboard = getDashboard(page);
	await page.getByRole("link", { name: "Sale", exact: true }).click();

	const content = dashboard.content();

	await content.entityList("outbound-list").item(0).edit();

	// Check title
	await dashboard.view("outbound-note").waitFor();
	await page.getByRole("heading", { name: "New Sale" }).first().waitFor();

	await dashboard.textEditableField().fillData("title");
	await dashboard.textEditableField().submit();

	await page.getByLabel("Main navigation").getByRole("link", { name: "Sale" }).click();

	await expect(content.entityList("outbound-list").item(0).getByText("title")).toBeVisible();
});

test("should update default warehouse for outbound note using dropdown", async ({ page }) => {
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	const dbHandle = await getDbHandle(page);

	// Create multiple warehouses for testing
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1", discount: 10 });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2", discount: 15 });

	// Create an outbound note
	await dbHandle.evaluate(createOutboundNote, { id: 1, displayName: "Default Warehouse Test" });

	// Navigate to outbound page
	await page.getByRole("link", { name: "Sale" }).click();

	await dashboard.content().entityList("outbound-list").item(0).edit();

	// Verify we're on the note page
	await dashboard.view("outbound-note").waitFor();
	await page.getByRole("heading", { name: "Default Warehouse Test" }).first().waitFor();

	const defaultWarehouseDropdown = page.locator("#defaultWarehouse");
	await defaultWarehouseDropdown.waitFor();

	// Verify initial default warehouse
	await expect(defaultWarehouseDropdown).toHaveValue("");

	// Change the default warehouse to Warehouse 2
	await defaultWarehouseDropdown.selectOption({ label: "Warehouse 2" });

	// Wait for the update to be processed
	await page.waitForTimeout(500);

	// Add a book to the note - it should use the new default warehouse
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1234567890", quantity: 1 }] as const);

	// Verify the book was added with Warehouse 2 as the default
	const table = dashboard.content().table("warehouse");
	await table.assertRows([
		{
			isbn: "1234567890",
			warehouseName: "Warehouse 2"
		}
	]);

	// Navigate away and back to ensure the default warehouse setting persists
	await page.getByLabel("Main navigation").getByRole("link", { name: "Sale" }).click();

	await dashboard.content().entityList("outbound-list").item(0).edit();

	// Verify the default warehouse selection was persisted
	await expect(defaultWarehouseDropdown).toHaveValue("2");
});

testInventory(
	`should assign scanned book to a warehouse according to stock availability -
	If book is present in only one warehouse it should be assigned to that warehouse even
	if default warehouse is different`,
	async ({ page, books, warehouses }) => {
		const dashboard = getDashboard(page);
		await dashboard.waitFor();

		const dbHandle = await getDbHandle(page);

		await page.getByRole("link", { name: "Sale" }).click();

		// Create an outbound note
		await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "Different Default Warehouse Test", defaultWarehouse: 2 });

		// create an commit an inbound Note
		await dbHandle.evaluate(createInboundNote, { id: 222, warehouseId: warehouses[0].id, bookId: books[0].isbn });

		// Create an inbound note and commit it to add book to Warehouse 1
		await dbHandle.evaluate(async (db, bookIsbn) => {
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (222, '${bookIsbn}', 1, 1)
       `);
		});

		await dbHandle.evaluate(commitNote, 222);

		await dashboard.content().entityList("outbound-list").waitFor();

		await dashboard.content().entityList("outbound-list").item(0).edit();

		// Verify we're on the note page
		await dashboard.view("outbound-note").waitFor();

		expect(dashboard.content().header().first()).toContainText("Different Default Warehouse Test");

		const defaultWarehouseDropdown = page.locator("#defaultWarehouse");
		await defaultWarehouseDropdown.waitFor();
		await defaultWarehouseDropdown.selectOption({ label: "Warehouse 2" });

		// Verify initial default warehouse
		await expect(defaultWarehouseDropdown).toHaveValue("2");

		// Add a book to the note - it should use the warehouse where it's present

		const isbnInput = page.getByPlaceholder("Scan to add books");
		await isbnInput.fill(books[0].isbn);

		await page.keyboard.press("Enter");
		// await l1.waitFor();

		// await dashboard.content().scanField().add(books[0].isbn);

		// Verify the book was added with Warehouse 2 as the default
		const table = dashboard.content().table("warehouse");
		await table.assertRows([
			{
				isbn: books[0].isbn,
				warehouseName: warehouses[0].displayName
			}
		]);
	}
);
testInventory(
	`should assign scanned book to a warehouse according to stock availability
 - If book is present in only one warehouse it should be assigned to that warehouse
 if no default warehouse is assigned`,
	async ({ page, books, warehouses }) => {
		await page.goto(baseURL);

		const dashboard = getDashboard(page);
		await dashboard.waitFor();

		const dbHandle = await getDbHandle(page);

		// Create an outbound note
		await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "No Default Warehouse Test" });

		// create an commit an inbound Note
		await dbHandle.evaluate(createInboundNote, { id: 222, warehouseId: warehouses[0].id, bookId: books[0].isbn });

		// Create an inbound note and commit it to add book to Warehouse 1
		await dbHandle.evaluate(async (db, bookIsbn) => {
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (222, '${bookIsbn}', 1, 1)
       `);
		});

		await dbHandle.evaluate(commitNote, 222);

		// Navigate to outbound page
		await page.getByRole("link", { name: "Sale" }).click();

		await dashboard.content().entityList("outbound-list").waitFor();

		await dashboard.content().entityList("outbound-list").item(0).edit();

		// Verify we're on the note page
		await dashboard.view("outbound-note").waitFor();
		expect(dashboard.content().header().first()).toContainText("No Default Warehouse Test");

		const defaultWarehouseDropdown = page.locator("#defaultWarehouse");
		await defaultWarehouseDropdown.waitFor();

		// Verify initial default warehouse
		await expect(defaultWarehouseDropdown).toHaveValue("");

		// Add a book to the note - it should use the warehouse where it's present

		const isbnInput = page.getByPlaceholder("Scan to add books");
		await isbnInput.fill(books[0].isbn);

		await page.keyboard.press("Enter");

		// Verify the book was added with Warehouse 2 as the default
		const table = dashboard.content().table("warehouse");
		await table.assertRows([
			{
				isbn: books[0].isbn,
				warehouseName: warehouses[0].displayName
			}
		]);
	}
);

testInventory(
	`should assign scanned book to a warehouse according to stock availability
	- If book is present in more than one warehouse, one of which is the default warehouse
	it should be assigned to the default warehouse`,
	async ({ page, books, warehouses }) => {
		await page.goto(baseURL);

		const dashboard = getDashboard(page);
		await dashboard.waitFor();

		const dbHandle = await getDbHandle(page);

		// Create an outbound note
		await dbHandle.evaluate(createOutboundNote, {
			id: 111,
			displayName: "Default Warehouse Test - 2 Warehouses"
		});

		// create and commit an inbound Note
		await dbHandle.evaluate(createInboundNote, { id: 222, warehouseId: warehouses[0].id, bookId: books[0].isbn });
		await dbHandle.evaluate(createInboundNote, { id: 333, warehouseId: warehouses[1].id, bookId: books[0].isbn });

		// Create an inbound note and commit it to add book to Warehouses
		await dbHandle.evaluate(async (db, bookIsbn) => {
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (222, '${bookIsbn}', 1, 1)
       `);
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (333, '${bookIsbn}', 2, 1)
       `);
		});

		await dbHandle.evaluate(commitNote, 222);
		await dbHandle.evaluate(commitNote, 333);

		// Navigate to outbound page
		await page.getByRole("link", { name: "Sale" }).click();

		await dashboard.content().entityList("outbound-list").waitFor();

		await dashboard.content().entityList("outbound-list").item(0).edit();
		const defaultWarehouseDropdown = page.locator("#defaultWarehouse");
		await defaultWarehouseDropdown.waitFor();
		await defaultWarehouseDropdown.selectOption({ label: "Warehouse 2" });

		// Verify we're on the note page
		await dashboard.view("outbound-note").waitFor();
		expect(dashboard.content().header().first()).toContainText("Default Warehouse Test - 2 Warehouses");

		// Verify initial default warehouse

		await expect(defaultWarehouseDropdown).toHaveValue("2");

		// Add a book to the note - it should use the warehouse where it's present

		const isbnInput = page.getByPlaceholder("Scan to add books");
		await isbnInput.fill(books[0].isbn);

		await page.keyboard.press("Enter");

		// Verify the book was added with Warehouse 2 as the default
		const table = dashboard.content().table("warehouse");
		await table.assertRows([
			{
				isbn: books[0].isbn,
				warehouseName: warehouses[1].displayName
			}
		]);
	}
);

testInventory(
	`should assign scanned book to a warehouse according to stock availability
	- If book is present in more than one warehouse, none of which is the default,
	it shouldn't be assigned to neither and the choice is left to the user`,
	async ({ page, books, warehouses }) => {
		await page.goto(baseURL);

		const dashboard = getDashboard(page);
		await dashboard.waitFor();

		const dbHandle = await getDbHandle(page);

		// Create an outbound note
		await dbHandle.evaluate(createOutboundNote, {
			id: 111,
			displayName: "Different default Warehouse Test - 2 Warehouses"
		});

		// create and commit an inbound Note
		await dbHandle.evaluate(createInboundNote, { id: 222, warehouseId: warehouses[0].id, bookId: books[0].isbn });
		await dbHandle.evaluate(createInboundNote, { id: 333, warehouseId: warehouses[1].id, bookId: books[0].isbn });

		// Create an inbound note and commit it to add book to Warehouses
		await dbHandle.evaluate(async (db, bookIsbn) => {
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (222, '${bookIsbn}', 1, 1)
       `);
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (333, '${bookIsbn}', 2, 1)
       `);
		});

		await dbHandle.evaluate(commitNote, 222);
		await dbHandle.evaluate(commitNote, 333);

		// Navigate to outbound page
		await page.getByRole("link", { name: "Sale" }).click();

		await dashboard.content().entityList("outbound-list").waitFor();

		await dashboard.content().entityList("outbound-list").item(0).edit();
		const defaultWarehouseDropdown = page.locator("#defaultWarehouse");
		await defaultWarehouseDropdown.waitFor();
		await defaultWarehouseDropdown.selectOption({ label: "Warehouse 3" });

		// Verify we're on the note page
		await dashboard.view("outbound-note").waitFor();
		expect(dashboard.content().header().first()).toContainText("Different default Warehouse Test - 2 Warehouses");

		// Verify initial default warehouse

		await expect(defaultWarehouseDropdown).toHaveValue("3");

		// Add a book to the note - it should use the warehouse where it's present

		const isbnInput = page.getByPlaceholder("Scan to add books");
		await isbnInput.fill(books[0].isbn);

		await page.keyboard.press("Enter");

		// Verify the book was added with no warehouse
		const table = dashboard.content().table("warehouse");
		await table.assertRows([
			{
				isbn: books[0].isbn,
				warehouseName: ""
			}
		]);
	}
);

testInventory(
	`should assign scanned book to a warehouse according to stock availability
	- If book is present in more than one warehouse, it should not assign scanned book to any
	of them if no selected default warehouse`,
	async ({ page, books, warehouses }) => {
		await page.goto(baseURL);

		const dashboard = getDashboard(page);
		await dashboard.waitFor();

		const dbHandle = await getDbHandle(page);

		// Create an outbound note
		await dbHandle.evaluate(createOutboundNote, {
			id: 111,
			displayName: "Different default Warehouse Test - 2 Warehouses"
		});

		// create and commit an inbound Note
		await dbHandle.evaluate(createInboundNote, { id: 222, warehouseId: warehouses[0].id, bookId: books[0].isbn });
		await dbHandle.evaluate(addVolumesToNote, [222, { isbn: books[1].isbn, quantity: 1 }] as const);

		await dbHandle.evaluate(createInboundNote, { id: 333, warehouseId: warehouses[1].id, bookId: books[0].isbn });

		// Create an inbound note and commit it to add book to Warehouses
		await dbHandle.evaluate(async (db, bookIsbn) => {
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (222, '${bookIsbn}', 1, 1)
       `);
			await db.exec(`
         INSERT INTO book_transaction (note_id, isbn, warehouse_id, quantity)
         VALUES (333, '${bookIsbn}', 2, 1)
       `);
		});

		await dbHandle.evaluate(commitNote, 222);
		await dbHandle.evaluate(commitNote, 333);

		// Navigate to outbound page
		await page.getByRole("link", { name: "Sale" }).click();

		await dashboard.content().entityList("outbound-list").waitFor();

		await dashboard.content().entityList("outbound-list").item(0).edit();
		const defaultWarehouseDropdown = page.locator("#defaultWarehouse");
		await defaultWarehouseDropdown.waitFor();
		await defaultWarehouseDropdown.selectOption({ label: "Warehouse 2" });

		// Verify we're on the note page
		await dashboard.view("outbound-note").waitFor();
		expect(dashboard.content().header().first()).toContainText("Different default Warehouse Test - 2 Warehouses");

		// Verify initial default warehouse

		await expect(defaultWarehouseDropdown).toHaveValue("2");

		// Add a book to the note - it should use the warehouse where it's present

		const isbnInput = page.getByPlaceholder("Scan to add books");
		await isbnInput.fill(books[0].isbn);

		await page.keyboard.press("Enter");

		// Verify the book was added with no warehouse
		const table = dashboard.content().table("warehouse");
		await table.assertRows([
			{
				isbn: books[0].isbn,
				warehouseName: "2"
			}
		]);

		// deselect default Warehouse
		await defaultWarehouseDropdown.selectOption({ index: 0 });

		await isbnInput.fill(books[1].isbn);

		await page.keyboard.press("Enter");

		// Verify the book was added with no warehouse
		await table.assertRows([
			{
				isbn: books[1].isbn,
				warehouseName: ""
			}
		]);
	}
);

testInventory("should handle force withdrawal for books not in stock", async ({ page, books, warehouses }) => {
	depends(books);

	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	const dbHandle = await getDbHandle(page);

	// Create an outbound note
	await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "Force Withdrawal Test" });

	// Navigate to outbound page and edit the note
	await page.getByRole("link", { name: "Sale" }).click();
	await dashboard.content().entityList("outbound-list").waitFor();
	await dashboard.content().entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();

	// Add a book that doesn't exist in any warehouse
	const nonExistentIsbn = "9999999999";
	const isbnInput = page.getByPlaceholder("Scan to add books");
	await isbnInput.fill(nonExistentIsbn);
	await page.keyboard.press("Enter");

	// Verify the book was added with no warehouse
	const table = dashboard.content().table("outbound-note");
	await table.assertRows([
		{
			isbn: nonExistentIsbn,
			warehouseName: ""
		}
	]);

	// Open the warehouse selector dropdown
	await table.row(0).field("warehouseName").click();

	// Verify "No stock available..." message is shown
	const dropdown = page.getByTestId("dropdown-menu");
	await expect(dropdown.getByText("No stock available...")).toBeVisible();

	// Click the "Force withdrawal" button
	await dropdown.getByText("Force withdrawal").click();

	// Verify the force withdrawal dialog appears
	const forceWithdrawalDialog = page.getByRole("dialog");
	await expect(forceWithdrawalDialog).toBeVisible();
	await expect(forceWithdrawalDialog).toContainText(`Force withdrawal for ${nonExistentIsbn}?`);
	await expect(forceWithdrawalDialog).toContainText("This book is out of stock.");

	// Verify all warehouses are available for selection
	const warehouseSelect = forceWithdrawalDialog.locator("#warehouse-force-withdrawal");
	for (const warehouse of warehouses) {
		await expect(warehouseSelect.locator(`option[value="${warehouse.id}"]`)).toBeVisible();
		await expect(warehouseSelect.locator(`option[value="${warehouse.id}"]`)).not.toHaveClass(/hidden/);
	}

	// Select a warehouse
	await warehouseSelect.selectOption({ label: warehouses[0].displayName });

	// Verify the notification about the effect
	await expect(forceWithdrawalDialog).toContainText(
		`A stock adjustment will be recorded for 1 copy of ${nonExistentIsbn} in ${warehouses[0].displayName}.`
	);

	// Confirm the force withdrawal
	await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

	// Verify the warehouse is now selected and marked as "Forced"
	await expect(table.row(0).field("warehouseName")).toContainText(warehouses[0].displayName);
	await expect(table.row(0).field("warehouseName")).toContainText("Forced");

	// Open the warehouse selector again
	await table.row(0).field("warehouseName").click();

	// Verify the dropdown still shows "No stock available..."
	await expect(dropdown.getByText("No stock available...")).toBeVisible();

	// Click the "Force withdrawal" button again
	await dropdown.getByText("Force withdrawal").click();

	// Verify the force withdrawal dialog appears with the previously selected warehouse
	await expect(forceWithdrawalDialog).toBeVisible();
	const selectedOption = await warehouseSelect.evaluate((select) => {
		return (select as HTMLSelectElement).value;
	});
	expect(selectedOption).toBe(warehouses[0].id.toString());

	// Try to confirm without changing the selection
	const confirmButton = forceWithdrawalDialog.getByRole("button", { name: "Confirm" });
	await expect(confirmButton).toBeDisabled();

	// Select a different warehouse
	await warehouseSelect.selectOption({ label: warehouses[1].displayName });
	await expect(confirmButton).toBeEnabled();

	// Confirm the new selection
	await confirmButton.click();

	// Verify the warehouse has been updated
	await expect(table.row(0).field("warehouseName")).toContainText(warehouses[1].displayName);
	await expect(table.row(0).field("warehouseName")).toContainText("Forced");
});

testInventory("should handle warehouse selection for books in stock", async ({ page, books, warehouses }) => {
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	const dbHandle = await getDbHandle(page);

	// Create an outbound note
	await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "Warehouse Selection Test" });

	// Setup stock for a book in two different warehouses with different quantities
	const INBOUND_NOTE_ID_1 = 222;
	const INBOUND_NOTE_ID_2 = 333;

	// Add 3 copies to Warehouse 1
	await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_1, warehouseId: warehouses[0].id });
	await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_1, { isbn: books[0].isbn, quantity: 3 }] as const);
	await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_1);

	// Add 5 copies to Warehouse 2
	await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_2, warehouseId: warehouses[1].id });
	await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_2, { isbn: books[0].isbn, quantity: 5 }] as const);
	await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_2);

	// Navigate to outbound page and edit the note
	await page.getByRole("link", { name: "Sale" }).click();
	await dashboard.content().entityList("outbound-list").waitFor();
	await dashboard.content().entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();

	// Add the book to the note
	const isbnInput = page.getByPlaceholder("Scan to add books");
	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	// Verify the book was added
	const table = dashboard.content().table("outbound-note");
	await table.assertRows([
		{
			isbn: books[0].isbn,
			warehouseName: ""
		}
	]);

	// Open the warehouse selector dropdown
	await table.row(0).field("warehouseName").click();

	// Verify both warehouses are shown with their available quantities
	const dropdown = page.getByTestId("dropdown-menu");
	await expect(dropdown.locator(`div:has-text("${warehouses[0].displayName}")`)).toBeVisible();
	await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toBeVisible();

	// Verify the stock quantities are displayed
	await expect(dropdown.locator(`div:has-text("${warehouses[0].displayName}")`)).toContainText("3 copies available");
	await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toContainText("5 copies available");

	// Select the first warehouse
	await dropdown.locator(`div:has-text("${warehouses[0].displayName}")`).click();

	// Verify the warehouse is now selected
	await expect(table.row(0).field("warehouseName")).toContainText(warehouses[0].displayName);
	await expect(table.row(0).field("warehouseName")).not.toContainText("Forced");

	// Open the warehouse selector again
	await table.row(0).field("warehouseName").click();

	// Click the "Force withdrawal" button
	await dropdown.getByText("Force withdrawal").click();

	// Verify the force withdrawal dialog appears
	const forceWithdrawalDialog = page.getByRole("dialog");
	await expect(forceWithdrawalDialog).toBeVisible();

	// Verify warehouses with stock are hidden from selection
	const warehouseSelect = forceWithdrawalDialog.locator("#warehouse-force-withdrawal");
	await expect(warehouseSelect.locator(`option[value="${warehouses[0].id}"]`)).toHaveClass(/hidden/);
	await expect(warehouseSelect.locator(`option[value="${warehouses[1].id}"]`)).toHaveClass(/hidden/);

	// Verify there are no selectable options (since all warehouses have stock)
	const options = await warehouseSelect.locator("option:not(.hidden):not([disabled])").count();
	expect(options).toBe(0);

	// Cancel the dialog
	await forceWithdrawalDialog.getByRole("button", { name: "Cancel" }).click();

	// Add a third warehouse with no stock
	await dbHandle.evaluate(upsertWarehouse, { id: warehouses.length + 1, displayName: "Empty Warehouse" });

	// Open the warehouse selector again
	await table.row(0).field("warehouseName").click();

	// Click the "Force withdrawal" button
	await dropdown.getByText("Force withdrawal").click();

	// Verify the force withdrawal dialog appears
	await expect(forceWithdrawalDialog).toBeVisible();

	// Verify warehouses with stock are hidden, but the empty warehouse is available
	await expect(warehouseSelect.locator(`option[value="${warehouses[0].id}"]`)).toHaveClass(/hidden/);
	await expect(warehouseSelect.locator(`option[value="${warehouses[1].id}"]`)).toHaveClass(/hidden/);
	await expect(warehouseSelect.locator('option:has-text("Empty Warehouse")')).not.toHaveClass(/hidden/);

	// Select the empty warehouse
	await warehouseSelect.selectOption({ label: "Empty Warehouse" });

	// Confirm the force withdrawal
	await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

	// Verify the warehouse is now selected and marked as "Forced"
	await expect(table.row(0).field("warehouseName")).toContainText("Empty Warehouse");
	await expect(table.row(0).field("warehouseName")).toContainText("Forced");
});

testInventory("should filter out warehouses with no remaining stock in dropdown", async ({ page, books, warehouses }) => {
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	const dbHandle = await getDbHandle(page);

	// Create an outbound note
	await dbHandle.evaluate(createOutboundNote, { id: 111, displayName: "Stock Filtering Test" });

	// Setup stock for a book in two different warehouses
	const INBOUND_NOTE_ID_1 = 222;
	const INBOUND_NOTE_ID_2 = 333;

	// Add 1 copy to Warehouse 1
	await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_1, warehouseId: warehouses[0].id });
	await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_1, { isbn: books[0].isbn, quantity: 1 }] as const);
	await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_1);

	// Add 2 copies to Warehouse 2
	await dbHandle.evaluate(createInboundNote, { id: INBOUND_NOTE_ID_2, warehouseId: warehouses[1].id });
	await dbHandle.evaluate(addVolumesToNote, [INBOUND_NOTE_ID_2, { isbn: books[0].isbn, quantity: 2 }] as const);
	await dbHandle.evaluate(commitNote, INBOUND_NOTE_ID_2);

	// Navigate to outbound page and edit the note
	await page.getByRole("link", { name: "Sale" }).click();
	await dashboard.content().entityList("outbound-list").waitFor();
	await dashboard.content().entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();

	// Add the book to the note and assign to Warehouse 1
	await dbHandle.evaluate(addVolumesToNote, [111, { isbn: books[0].isbn, quantity: 1, warehouseId: warehouses[0].id }] as const);

	// Verify the book was added with Warehouse 1
	const table = dashboard.content().table("outbound-note");
	await table.assertRows([
		{
			isbn: books[0].isbn,
			warehouseName: warehouses[0].displayName
		}
	]);

	// Add the book again
	const isbnInput = page.getByPlaceholder("Scan to add books");
	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	// Verify a new row was added with no warehouse
	await table.assertRows([
		{
			isbn: books[0].isbn,
			warehouseName: ""
		},
		{
			isbn: books[0].isbn,
			warehouseName: warehouses[0].displayName
		}
	]);

	// Open the warehouse selector dropdown for the new row
	await table.row(0).field("warehouseName").click();

	// Verify only Warehouse 2 is shown (since Warehouse 1's stock is fully allocated)
	const dropdown = page.getByTestId("dropdown-menu");
	await expect(dropdown.locator(`div:has-text("${warehouses[0].displayName}")`)).not.toBeVisible();
	await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toBeVisible();
	await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toContainText("2 copies available");

	// Select Warehouse 2
	await dropdown.locator(`div:has-text("${warehouses[1].displayName}")`).click();

	// Add the book a third time
	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	// Verify a new row was added with no warehouse
	await table.assertRows([
		{
			isbn: books[0].isbn,
			warehouseName: ""
		},
		{
			isbn: books[0].isbn,
			warehouseName: warehouses[1].displayName
		},
		{
			isbn: books[0].isbn,
			warehouseName: warehouses[0].displayName
		}
	]);

	// Open the warehouse selector dropdown for the new row
	await table.row(0).field("warehouseName").click();

	// Verify Warehouse 2 is still shown with 1 copy available (since we've allocated 1 of 2)
	await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toBeVisible();
	await expect(dropdown.locator(`div:has-text("${warehouses[1].displayName}")`)).toContainText("1 copy available");

	// Select Warehouse 2 again
	await dropdown.locator(`div:has-text("${warehouses[1].displayName}")`).click();

	// Add the book a fourth time
	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	// Verify a new row was added with no warehouse
	await table.assertRows([
		{
			isbn: books[0].isbn,
			warehouseName: ""
		},
		{
			isbn: books[0].isbn,
			warehouseName: warehouses[1].displayName
		},
		{
			isbn: books[0].isbn,
			warehouseName: warehouses[1].displayName
		},
		{
			isbn: books[0].isbn,
			warehouseName: warehouses[0].displayName
		}
	]);

	// Open the warehouse selector dropdown for the new row
	await table.row(0).field("warehouseName").click();

	// Verify no warehouses are shown in the dropdown (all stock is allocated)
	await expect(dropdown.getByText("No stock available...")).toBeVisible();

	// Click the "Force withdrawal" button
	await dropdown.getByText("Force withdrawal").click();

	// Verify the force withdrawal dialog appears
	const forceWithdrawalDialog = page.getByRole("dialog");
	await expect(forceWithdrawalDialog).toBeVisible();

	// Verify all warehouses are available for force withdrawal (since we're forcing)
	const warehouseSelect = forceWithdrawalDialog.locator("#warehouse-force-withdrawal");
	await expect(warehouseSelect.locator(`option[value="${warehouses[0].id}"]`)).not.toHaveClass(/hidden/);
	await expect(warehouseSelect.locator(`option[value="${warehouses[1].id}"]`)).not.toHaveClass(/hidden/);

	// Select Warehouse 1 for force withdrawal
	await warehouseSelect.selectOption({ label: warehouses[0].displayName });

	// Confirm the force withdrawal
	await forceWithdrawalDialog.getByRole("button", { name: "Confirm" }).click();

	// Verify the warehouse is now selected and marked as "Forced"
	await expect(table.row(0).field("warehouseName")).toContainText(warehouses[0].displayName);
	await expect(table.row(0).field("warehouseName")).toContainText("Forced");
});
