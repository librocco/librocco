import { type Page, test } from "@playwright/test";

import { baseURL } from "../../constants";

import { getDashboard } from "../../helpers";

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

const createNote = async (page: Page) =>
	// For all inbound note tests (in this suite) we're using a first warehouse created
	// ("New Warehouse") to create notes
	getDashboard(page).sidebar().linkGroup("New Warehouse").createNote();

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	const sidebar = dashboard.sidebar();

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// Create a warehouse first to which we can add the notes
	await sidebar.createWarehouse();

	// Navigate to the inbound
	await dashboard.navigate("inbound");

	// Create a new note to work with
	await createNote(page);
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
	await row.assertField("isbn", book1.isbn);
	await row.assertField("title", book1.title);
	await row.assertField("authors", book1.authors);
	// The default quantity is 1
	await row.assertField("quantity", 1);
	await row.assertField("price", book1.price);
	await row.assertField("year", book1.year);
	await row.assertField("publisher", book1.publisher);
	await row.assertField("editedBy", book1.editedBy);
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();
	await row.assertField("outOfPrint", book1.outOfPrint);
});

test("should show empty or \"N/A\" fields and not 'null' or 'undefined' (in case no book data is provided)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Add a book transaction without book data (only isbn)
	await content.scanField().add("1234567890");

	// Check the displayed transaction (field by field)
	const row = content.entries("inbound").row(0);
	await row.assertField("isbn", book1.isbn);
	await row.assertField("title", "N/A");
	await row.assertField("authors", "N/A");
	// The default quantity is 1
	await row.assertField("quantity", 1);
	await row.assertField("price", "N/A" as any);
	await row.assertField("year", "N/A");
	await row.assertField("publisher", "");
	await row.assertField("editedBy", "");
	// Should show 'Edit' button
	await row.getByRole("button", { name: "Edit" }).waitFor();
	await row.assertField("outOfPrint", false);
});

runCommonTransactionTests("inbound", createNote);
