import { Page, test } from "@playwright/test";

import { NoteState, NoteTempState } from "@librocco/shared";

import { ViewName } from "../../helpers/types";

import { getDashboard } from "../../helpers";

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

export const runCommonTransactionTests = (view: ViewName, createNote: (page: Page) => Promise<void>) => {
	test("should add a transaction to the note by 'typing the ISBN into the 'Scan' field and pressing \"Enter\" (the same way scenner interaction would be processed)", async ({
		page
	}) => {
		const dashboard = getDashboard(page);

		const content = dashboard.content();
		const entries = content.entries(view);
		const scanField = content.scanField();

		// Open the book form with the isbn added to the form using the 'Scan' field
		await scanField.add("1234567890");

		// Check updates in the entries table
		await entries.assertRows([
			{
				isbn: "1234567890",
				quantity: 1
			}
		]);
	});

	test("should aggregate the quantity for the same isbn", async ({ page }) => {
		const dashboard = getDashboard(page);

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries(view);

		// Create two transactions with different isbns (quanitity 1 each)
		await scanField.add("1234567890");
		await scanField.add("1234567891");

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

		// Add another transaction for "1234567890"
		await scanField.add("1234567890");

		// No new transaction should be added, but the quantity of "1234567890" should be increased
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
		const entries = content.entries(view);

		/***** @TODO this part should be replaced by programmatically creating a book data entry */
		// Add transaction with book 1 (filling the form with book data)
		await scanField.create();
		await bookForm.fillBookData(book1);
		await bookForm.submit("click");

		// Add another note (when programmatic setup is supported, we will be testing with the default note )
		await createNote(page);
		/***** @TODO this part should be replaced by programmatically creating a book data entry */

		// Add book 1 again (this time using only isbn and 'Add' button)
		await scanField.add(book1.isbn);

		// Check that the new note contains the full book data in the transaction
		await entries.row(0).assertFields(book1);
	});

	test("should allow for changing of transaction quantity using the quantity field", async ({ page }) => {
		const dashboard = getDashboard(page);

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries(view);

		// Create a new note to work with
		await createNote(page);

		// Create book 1 transaction by filling out the form
		await scanField.add("1234567890");

		// Change the quantity of the transaction
		await entries.row(0).setQuantity(3);

		await entries.assertRows([{ isbn: "1234567890", quantity: 3 }]);

		// Create book 2 transaction by filling out the form
		await scanField.add("1234567891");

		await entries.assertRows([
			{ isbn: "1234567890", quantity: 3 },
			{ isbn: "1234567891", quantity: 1 }
		]);

		// Change the quantity of the second transaction
		await entries.row(1).setQuantity(5);

		await entries.assertRows([
			{ isbn: "1234567890", quantity: 3 },
			{ isbn: "1234567891", quantity: 5 }
		]);

		// Add a third transaction
		await scanField.add("1234567892");

		await entries.assertRows([
			{ isbn: "1234567890", quantity: 3 },
			{ isbn: "1234567891", quantity: 5 },
			{ isbn: "1234567892", quantity: 1 }
		]);
	});

	test("should sort transactions by isbn", async ({ page }) => {
		const dashboard = getDashboard(page);

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries(view);

		// We're adding books in non-aplphabetical order to check if they're sorted correctly
		const isbns = ["1234567891", "1234567890", "1234567892"];

		// Add transactions
		for (const isbn of isbns) {
			await scanField.add(isbn);
		}

		// Check that the transactions are sorted by isbn
		await entries.assertRows([{ isbn: "1234567890" }, { isbn: "1234567891" }, { isbn: "1234567892" }]);
	});

	test("should delete the transaction from the note when when selected for deletion and deletion confirmed", async ({ page }) => {
		const dashboard = getDashboard(page);

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries(view);

		// Add three transactions
		const isbns = ["1234567890", "1234567891", "1234567892"];
		for (const isbn of isbns) {
			await scanField.add(isbn);
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

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries(view);

		// Add three transactions
		const isbns = ["1234567890", "1234567891", "1234567892"];
		for (const isbn of isbns) {
			await scanField.add(isbn);
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

		const content = dashboard.content();
		const scanField = content.scanField();
		const entries = content.entries(view);

		// Add three transactions
		const isbns = ["1234567890", "1234567891", "1234567892"];
		for (const isbn of isbns) {
			await scanField.add(isbn);
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

	/**
	 * @TODO : Unskip this when working on https://github.com/librocco/librocco/issues/288
	 */
	test.skip("should not allow committing a note with 0-quantity transaction(s)", async ({ page }) => {
		const dashboard = getDashboard(page);

		const content = dashboard.content();
		const entries = content.entries(view);
		const statePicker = content.statePicker();

		// Add a transaction with 0 quantity
		await content.scanField().add("1234567890");
		await entries.row(0).setQuantity(0);

		// Try and commit the note
		await statePicker.select(NoteState.Committed);

		/** @TODO This is a terrible way to assert this and is not really communicating anything, update when we have error display */
		await page.waitForTimeout(1000);
		await statePicker.assertState(NoteTempState.Committing);
	});
};