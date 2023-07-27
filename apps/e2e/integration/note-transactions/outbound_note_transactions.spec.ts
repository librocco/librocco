import { test } from "@playwright/test";

import { baseURL } from "../../constants";

import { getDashboard, getDbHandle } from "../../helpers";

import { runCommonTransactionTests } from "./shared_tests";

const book1 = {
	isbn: "1234567890",
	title: "Book 1",
	price: 12,
	year: "2020",
	authors: "Author and Sons",
	publisher: "Reed Elsevier",
	editedBy: "Sons",
	outOfPrint: true
};

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// Navigate to the outbound view
	await dashboard.navigate("outbound");

	// Create a new note to work with
	await getDashboard(page).sidebar().createNote();
});

test("should display correct transaction fields for the outbound note view", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const bookForm = dashboard.bookForm();

	// Fill the book form, creating a transaction
	await content.scanField().create();
	await bookForm.fillBookData(book1);
	await bookForm.submit("click");

	// Check the displayed transaction (field by field)
	const row = content.entries("outbound").row(0);
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
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Add a book transaction without book data (only isbn)
	await content.scanField().add("1234567890");

	// Check the displayed transaction (field by field)
	const row = content.entries("outbound").row(0);
	await row.field("isbn").assert(book1.isbn);
	await row.field("title").assert("N/A");
	await row.field("authors").assert("N/A");
	// The default quantity is 1
	await row.field("quantity").assert(1);
	await row.field("price").assert("N/A" as any);
	await row.field("year").assert("N/A");
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();

	// There is no warehouse the book is available in so 'not-found' should be displayed
	await row.field("warehouseName").assert("not-found");
});

runCommonTransactionTests("outbound");

/**
 * @TODO unskip this when working on https://github.com/librocco/librocco/issues/300
 */
test.skip("transaction should default to the only warehouse, the given book is available in if there is only one", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create a warehouse to work with
		const wh = await db.warehouse("wh-1").setName({}, "Warehouse 1");

		// Add the book to the warehouse (through an inbound note)
		await wh
			.note()
			.addVolumes({ isbn: "1234567890", quantity: 1 })
			.then((n) => n.commit({}));
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Add a book transaction to the note
	await content.scanField().add("1234567890");

	// Assert relevant fields (isbn, quantity and warehouseName)
	await content.entries("outbound").row(0).assertFields({ isbn: "1234567890", quantity: 1, warehouseName: "Warehouse 1" });
});

test("transaction should allow for warehouse selection if there is more than one warehouse given book is available in", async ({
	page
}) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create two warehouses with the book in stock
		const wh1 = await db.warehouse("wh-1").setName({}, "Warehouse 1");
		const wh2 = await db.warehouse("wh-2").setName({}, "Warehouse 2");

		// Add the book to both warehouses
		await Promise.all([
			wh1
				.note()
				.addVolumes({ isbn: "1234567890", quantity: 1 })
				.then((n) => n.commit({})),
			wh2
				.note()
				.addVolumes({ isbn: "1234567890", quantity: 1 })
				.then((n) => n.commit({}))
		]);
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Add a book transaction to the note
	await content.scanField().add("1234567890");

	// Assert relevant fields (isbn, quantity and warehouseName)
	await content.entries("outbound").row(0).assertFields({ isbn: "1234567890", quantity: 1, warehouseName: "" });
});
