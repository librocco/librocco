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

	// Navigate to the inbound
	await dashboard.navigate("inbound");

	// Create a warehouse to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) => db.warehouse("wh-1").create());

	// Create a new note to work with
	await getDashboard(page).sidebar().linkGroup("New Warehouse").createNote();
});

test("should display correct transaction fields for the inbound note view", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const bookForm = dashboard.bookForm();

	// Fill the book form, creating a transaction
	await content.scanField().create();
	await bookForm.fillBookData(book1);
	await bookForm.submit("click");

	// Check the displayed transaction (field by field)
	const row = content.entries("inbound").row(0);
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
});

test("should show empty or \"N/A\" fields and not 'null' or 'undefined' (in case no book data is provided)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Add a book transaction without book data (only isbn)
	await content.scanField().add("1234567890");

	// Check the displayed transaction (field by field)
	const row = content.entries("inbound").row(0);
	await row.field("isbn").assert(book1.isbn);
	await row.field("title").assert("N/A");
	await row.field("authors").assert("N/A");
	// The default quantity is 1
	await row.field("quantity").assert(1);
	await row.field("price").assert("N/A" as any);
	await row.field("year").assert("N/A");
	await row.field("publisher").assert("");
	await row.field("editedBy").assert("");
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();
	await row.field("outOfPrint").assert(false);
});

runCommonTransactionTests("inbound");
