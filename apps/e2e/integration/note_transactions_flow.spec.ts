import { NoteState, NoteTempState } from "@librocco/shared";
import { Page, test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard } from "../helpers";

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

const book2 = {
	isbn: "1234567891",
	title: "Book 2",
	price: 20,
	year: "2020",
	authors: "Some other author",
	publisher: "Penguin Random House",
	editedBy: "No one",
	outOfPrint: false
};

const book3 = {
	isbn: "1234567892",
	title: "Big Bad Wolf",
	price: 10,
	year: "1999",
	authors: "Walter White",
	publisher: "Penguin Random House",
	editedBy: "Saul Goodman",
	outOfPrint: false
};

const createNoteForView = (page: Page, view: "inbound" | "outbound") => {
	const sidebar = getDashboard(page).sidebar();

	// Outbound notes are created against a default warehouse
	if (view === "outbound") {
		return sidebar.createNote();
	}

	// For all inbound note tests (in this suite) we're using a first warehouse created
	// ("New Warehouse") to create notes
	return sidebar.linkGroup("New Warehouse").createNote();
};

const runNoteTransactionTests = (view: "inbound" | "outbound") => {
	test.beforeEach(async ({ page }) => {
		// Load the app
		await page.goto(baseURL);

		const dashboard = getDashboard(page);
		const sidebar = dashboard.sidebar();

		// Wait for the app to become responsive (when the default view is loaded)
		await dashboard.waitFor();

		// Create a warehouse first (to which we can add the notes)
		await sidebar.createWarehouse();

		// Navigate to the inbound note page
		await dashboard.navigate(view);

		// Create a new note to work with
		await createNoteForView(page, view);
	});

	test("should add a transaction to the note by filling out the book form on 'Create' button", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const entries = content.entries();

		// Open the book form by clicking the 'Create' button
		await content.scanField().create();

		// Filling out the book form field by field
		await bookForm.field("isbn").set("1234567890");
		await bookForm.field("title").set("Book 1");
		await bookForm.field("price").set(12);
		await bookForm.field("year").set("2020");
		await bookForm.field("authors").set("Author and Sons");
		await bookForm.field("publisher").set("Reed Elsevier");
		await bookForm.field("editedBy").set("Sons");
		await bookForm.field("outOfPrint").set(true);

		await bookForm.submit();

		// Check updates in the entries table cell by bell
		const row1 = entries.row(0);
		await row1.assertField("isbn", "1234567890");
		await row1.assertField("quantity", 1); // Default quantity should be 1
		await row1.assertField("title", "Book 1");
		await row1.assertField("price", 12);
		await row1.assertField("year", "2020");
		await row1.assertField("authors", "Author and Sons");
		await row1.assertField("publisher", "Reed Elsevier");
		await row1.assertField("editedBy", "Sons");
		await row1.assertField("outOfPrint", true);

		// Create another book using the automated api (with same fields, but different isbn, to check they work the same way)
		await content.scanField().create();
		await bookForm.fillBookData({
			isbn: "1234567891",
			title: "Book 1",
			price: 12,
			year: "2020",
			authors: "Author and Sons",
			publisher: "Reed Elsevier",
			editedBy: "Sons",
			outOfPrint: true
		});
		await bookForm.submit();

		// Check that the updates are shown in row 2
		const row2 = entries.row(1);
		await row2.assertField("isbn", "1234567891");
		await row2.assertField("quantity", 1); // Default quantity should be 1
		await row2.assertField("title", "Book 1");
		await row2.assertField("price", 12);
		await row2.assertField("year", "2020");
		await row2.assertField("authors", "Author and Sons");
		await row2.assertField("publisher", "Reed Elsevier");
		await row2.assertField("editedBy", "Sons");
		await row2.assertField("outOfPrint", true);

		// Use automated api to check all rows
		await entries.assertRows(
			[
				{
					isbn: "1234567890",
					quantity: 1,
					title: "Book 1",
					price: 12,
					year: "2020",
					authors: "Author and Sons",
					publisher: "Reed Elsevier",
					editedBy: "Sons",
					outOfPrint: true
				},
				{
					isbn: "1234567891",
					quantity: 1,
					title: "Book 1",
					price: 12,
					year: "2020",
					authors: "Author and Sons",
					publisher: "Reed Elsevier",
					editedBy: "Sons",
					outOfPrint: true
				}
			],
			{ strict: true }
		);
	});

	test("should add a transaction to the note by 'typing the ISBN into the 'Scan' field and filling out the rest of the form", async ({
		page
	}) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const entries = content.entries();
		const scanField = content.scanField();

		// Open the book form with the isbn added to the form using the 'Scan' field
		await scanField.fill("1234567890");
		// Open the form
		await scanField.create();

		// Fill out all of the form fields, except for the isbn (should be filled out already)
		await bookForm.field("title").set("Book 1");
		await bookForm.field("price").set(12);
		await bookForm.field("year").set("2020");
		await bookForm.field("authors").set("Author and Sons");
		await bookForm.field("publisher").set("Reed Elsevier");
		await bookForm.field("editedBy").set("Sons");
		await bookForm.field("outOfPrint").set(true);

		await bookForm.submit();

		// Check updates in the entries table
		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 1,
				title: "Book 1",
				price: 12,
				year: "2020",
				authors: "Author and Sons",
				publisher: "Reed Elsevier",
				editedBy: "Sons",
				outOfPrint: true
			}
		]);
	});

	test("should aggregate the quantity of the same book", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries();

		// Create book 1 transaction by filling out the form
		await scanField.create();
		await bookForm.fillBookData(book1);
		await bookForm.submit();

		// Create book 2 transaction by filling out the form
		await scanField.create();
		await bookForm.fillBookData(book2);
		await bookForm.submit();

		// Check that both books are in the entries table
		// (by not using 'strict: true', we're asserting only by values we care about)
		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 1
			},
			{
				isbn: "1234567891",
				quantity: 1
			}
		]);

		// Create another transaction for book 1
		await scanField.fill("1234567890");
		await scanField.create();
		await bookForm.fillExistingData();
		await bookForm.submit("click");

		// No new transaction should be added, but the quantity of book 1 should be increased
		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 2
			},
			{
				isbn: "1234567891",
				quantity: 1
			}
		]);
	});

	test("should autofill the existing book data when adding a transaction with existing isbn", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries();

		// Add transaction with book 1
		await scanField.create();
		await bookForm.fillBookData(book1);
		await bookForm.submit();

		// Add another note
		await createNoteForView(page, view);

		// Add book 1 again
		await scanField.fill("1234567890");
		await scanField.create();

		/** @TEMP : hopefully, this won't be necessary in the future */
		await bookForm.fillExistingData();
		await bookForm.submit("click");
		/**	@TEMP */

		// Check that the new note contains the full book data in the transaction
		await entries.row(0).assertFields(book1);
	});

	test("should allow for changing of transaction quantity using the quantity field", async ({ page }) => {
		const dashboard = getDashboard(page);

		const sidebar = dashboard.sidebar();
		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries();

		// Create a new note to work with
		await sidebar.linkGroup("New Warehouse").createNote();

		// Create book 1 transaction by filling out the form
		await scanField.create();
		await bookForm.fillBookData(book1);
		await bookForm.submit();

		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 1
			}
		]);

		// Change the quantity of the transaction
		await entries.row(0).setQuantity(3);

		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 3
			}
		]);

		// Create book 2 transaction by filling out the form
		await scanField.create();
		await bookForm.fillBookData(book2);
		await bookForm.submit();

		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 3
			},
			{
				isbn: "1234567891",
				quantity: 1
			}
		]);

		// Change the quantity of the second transaction
		await entries.row(1).setQuantity(5);

		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 3
			},
			{
				isbn: "1234567891",
				quantity: 5
			}
		]);

		// Add a third transaction
		await scanField.create();
		await bookForm.fillBookData(book3);
		await bookForm.submit();

		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 3
			},
			{
				isbn: "1234567891",
				quantity: 5
			},
			{
				isbn: "1234567892",
				quantity: 1
			}
		]);
	});

	test("should sort transactions by isbn", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries();

		// We're adding books in non-aplphabetical order to check if they're sorted correctly
		const books = [book2, book3, book1];

		// Add transactions
		for (const book of books) {
			await scanField.create();
			await bookForm.fillBookData(book);
			await bookForm.submit();
		}

		// Check that the transactions are sorted by isbn
		await entries.assertRows([
			{
				isbn: "1234567890"
			},
			{
				isbn: "1234567891"
			},
			{
				isbn: "1234567892"
			}
		]);
	});

	test("should delete the transaction from the note when when selected for deletion and deletion confirment", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries();

		// Add three books
		const books = [book1, book2, book3];
		for (const book of books) {
			await scanField.create();
			await bookForm.fillBookData(book);
			await bookForm.submit();
		}

		// Delete the second transaction
		await entries.row(1).select();

		// Confirm the deletion
		await entries.deleteSelected();

		// Check that the second transaction was deleted
		await entries.assertRows([
			{
				isbn: "1234567890"
			},
			{
				isbn: "1234567892"
			}
		]);
	});

	test("should delete multiple transactions if so selected", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries();

		// Add three books
		const books = [book1, book2, book3];
		for (const book of books) {
			await scanField.create();
			await bookForm.fillBookData(book);
			await bookForm.submit();
		}

		// Select all transactions
		await entries.selectAll();

		// Unselect the second transaction
		await entries.row(1).unselect();

		// Confirm the deletion
		await entries.deleteSelected();

		// Check that the first and last transactions were deleted
		await entries.assertRows([
			{
				isbn: "1234567891"
			}
		]);
	});

	test("should delete all transactions if all selected", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries();

		// Add three books
		const books = [book1, book2, book3];
		for (const book of books) {
			await scanField.create();
			await bookForm.fillBookData(book);
			await bookForm.submit();
		}

		// Select all transactions
		await entries.selectAll();

		// Confirm the deletion
		await entries.deleteSelected();

		// Check that the second transaction was deleted
		await entries.assertRows([]);
	});

	test("should not allow committing a note with no transactions", async ({ page }) => {
		const dashboard = getDashboard(page);

		const statePicker = dashboard.content().statePicker();

		// Try and commit the note
		await statePicker.select(NoteState.Committed);

		/** @TODO This is a terrible way to assert this and is not really communicating anything, update when we have error display */
		await page.waitForTimeout(1000);
		await statePicker.assertState(NoteTempState.Committing);
	});

	test("should not allow committing a note with 0-quantity transaction(s)", async ({ page }) => {
		const dashboard = getDashboard(page);

		const bookForm = dashboard.bookForm();

		const content = dashboard.content();
		const entries = content.entries();
		const statePicker = content.statePicker();

		// Add a transaction with 0 quantity
		await content.scanField().create();
		await bookForm.fillBookData(book1);
		await bookForm.submit();
		await entries.row(0).setQuantity(0);

		// Try and commit the note
		await statePicker.select(NoteState.Committed);

		/** @TODO This is a terrible way to assert this and is not really communicating anything, update when we have error display */
		await page.waitForTimeout(1000);
		await statePicker.assertState(NoteTempState.Committing);
	});
};

test.describe("Inbound note view", () => {
	runNoteTransactionTests("inbound");
});
