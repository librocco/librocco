import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { testOrders } from "@/helpers/fixtures";
import { PlacedSupplierOrderLine } from "@/helpers/types";

// * Note: its helpful to make an assertion after each <enter> key
// as it seems that Playwright may start running assertions before page data has fully caught up
testOrders("should show correct initial state of reconciliation page", async ({ page, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Verify initial UI elements
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
	await expect(page.getByPlaceholder("Enter ISBN of delivered books")).toBeVisible();
	await expect(page.getByText("Scan or enter the ISBNs of the delivered books to begin reconciliation.")).toBeVisible();
	await expect(page.getByText(placedOrders[0].lines[0].isbn)).not.toBeVisible();
	await expect(page.getByRole("button", { name: "Commit" })).toBeDisabled();
	await expect(page.getByRole("button", { name: "Compare" })).toHaveCount(1);
	await expect(page.getByRole("button", { name: "Compare" }).nth(1)).not.toBeVisible();
});

testOrders("should show correct comparison when quantities match ordered amounts", async ({ page, books, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	const secondRow = table.getByRole("row").nth(2);

	// Calculate total ordered quantity from the orders ordered from sup1
	// we know it's sup1 bc we only selected the first two orders
	// and orders are sorted by sup name
	const placedOrderLinesWithSup1 = placedOrders.reduce(
		(acc: PlacedSupplierOrderLine[], { order, lines }) => (order.supplier_name === "sup1" ? [...acc, ...lines] : acc),
		[]
	);

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrderLinesWithSup1[0].isbn);
	await page.keyboard.press("Enter");
	await expect(firstRow.getByRole("cell", { name: placedOrderLinesWithSup1[0].isbn, exact: true })).toBeVisible();

	await isbnInput.focus();
	await isbnInput.fill(placedOrderLinesWithSup1[0].isbn);
	await page.keyboard.press("Enter");
	// scanned quantity === delivered quantity
	await expect(firstRow.getByRole("cell", { name: placedOrderLinesWithSup1[0].isbn, exact: true })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: `2`, exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Compare" }).first().click();

	// Verify comparison view
	const supplierNameRow = table.getByRole("row").nth(1);
	supplierNameRow.getByRole("cell", { name: placedOrderLinesWithSup1[0].supplier_name });

	firstRow.getByRole("cell", { name: books[0].isbn });
	await expect(secondRow.getByRole("checkbox")).toBeChecked();

	// there shouldn't be any unmatched books
	await expect(page.getByText("Unmatched Books")).not.toBeVisible();

	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 2")).toBeVisible(); // Assuming 1 was ordered
});

testOrders("should correctly increment quantities when scanning same ISBN multiple times", async ({ page, books, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	firstRow.getByRole("cell", { name: placedOrders[0].lines[0].isbn });

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Wait for the first row to be added
	await expect(table.getByText("1111111111")).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	const secondRow = table.getByRole("row").nth(2);

	await expect(firstRow.getByRole("cell", { name: "2" })).toBeVisible();

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	// Check new isbn row is visible
	await expect(table.getByText(books[0].isbn)).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check the 111111 row quantity is updated
	await expect(firstRow.getByRole("cell", { name: "1111111111", exact: true })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: "3" })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[0].isbn, exact: true })).toBeVisible();

	await expect(secondRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});

testOrders("should show over-delivery when scanned quantities are more than ordered amounts", async ({ page, placedOrders, books }) => {
	books;
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();

	// Calculate total ordered quantity from the orders ordered from sup1
	// we know it's sup1 bc we only selected the first two orders
	// and orders are sorted by sup name
	const placedOrderLinesWithSup1 = placedOrders.reduce(
		(acc: PlacedSupplierOrderLine[], { order, lines }) => (order.supplier_name === "sup1" ? [...acc, ...lines] : acc),
		[]
	);
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Add some scanned books
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrderLinesWithSup1[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	expect(table.getByText(placedOrderLinesWithSup1[0].isbn)).toBeVisible();

	const firstRow = table.getByRole("row").nth(1);
	await expect(firstRow.getByRole("cell", { name: placedOrderLinesWithSup1[0].isbn }).first()).toBeVisible();

	await isbnInput.fill(placedOrderLinesWithSup1[0].isbn);
	await page.keyboard.press("Enter");

	await expect(firstRow.getByRole("cell", { name: placedOrderLinesWithSup1[0].isbn }).first()).toBeVisible();

	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	const supplierNameRow = table.getByRole("row").nth(1);
	supplierNameRow.getByRole("cell", { name: "sup1" });

	// Verify comparison shows over-delivery
	await expect(page.getByText("2 / 2")).toBeVisible();
});

testOrders(
	"should show under-delivery when ordered books are not scanned or the scanned quantities are less than ordered amounts",
	async ({ page, placedOrders, books }) => {
		// Navigate to reconciliation
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		await page.getByText("Ordered").nth(1).click();
		await page.getByRole("checkbox").nth(1).click();
		await page.getByRole("checkbox").nth(2).click();

		await page.getByText("Reconcile").first().click();

		const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

		// Scan less quantity than ordered
		// From fixtures we know placedOrders[0].lines[0] has quantity: 1
		await isbnInput.fill(books[0].isbn);
		await page.keyboard.press("Enter");

		// Move to comparison view
		await page.getByRole("button", { name: "Compare" }).click();

		// Verify comparison table structure
		const table = page.getByRole("table");

		// Check supplier name row
		const supplierNameRow = table.getByRole("row").nth(1);
		await expect(supplierNameRow.getByRole("cell", { name: "sup1" })).toBeVisible();

		// Check book details row
		const bookRow = table.getByRole("row").nth(2);
		await expect(bookRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();

		// there shouldn't be any unmatched books
		await expect(page.getByText("Unmatched Books")).not.toBeVisible();

		// Verify delivery stats show under-delivery
		await expect(page.getByText("Total delivered:")).toBeVisible();

		// Calculate total ordered quantity from the orders ordered from sup1
		// we know it's sup1 bc we only selected the first two orders
		// and orders are sorted by sup name
		const placedOrderLinesWithSup1 = placedOrders.reduce(
			(acc: PlacedSupplierOrderLine[], { order, lines }) => (order.supplier_name === "sup1" ? [...acc, ...lines] : acc),
			[]
		);

		const totalOrderedLines = placedOrderLinesWithSup1.reduce((sum) => sum + 1, 0);

		// We only scanned one book, so expect "1 / {totalOrdered}"
		await expect(page.getByText(`1 / ${totalOrderedLines}`)).toBeVisible();
	}
);

testOrders("should show unmatched deliveries when ordered books do not match scanned books", async ({ page, placedOrders, books }) => {
	// Navigate to reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Scan non ordered books
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	await expect(table.getByText(placedOrders[0].lines[0].isbn)).toBeVisible();

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");

	await expect(table.getByText(books[1].isbn)).toBeVisible();

	// Move to comparison view
	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	// Verify comparison table structure

	// Check supplier name row
	const unmatchedRow = table.getByRole("row").nth(1);
	await expect(unmatchedRow.getByRole("cell", { name: "unmatched" })).toBeVisible();

	// Check book details row
	const unmatchedBookRow = table.getByRole("row").nth(2);
	await expect(unmatchedBookRow.getByRole("cell", { name: books[1].isbn })).toBeVisible();

	const supplierNameRow = table.getByRole("row").nth(3);
	await expect(supplierNameRow.getByRole("cell", { name: "sup1" })).toBeVisible();

	const matchedBookRow = table.getByRole("row").nth(4);
	const secondMatchedBookRow = table.getByRole("row").nth(5);

	await expect(matchedBookRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(secondMatchedBookRow.getByRole("cell", { name: books[2].isbn })).toBeVisible();

	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 2")).toBeVisible();
});

testOrders("should show correct delivery stats in commit view", async ({ page, books, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);

	firstRow.getByRole("cell", { name: placedOrders[0].lines[0].isbn });

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");

	// Wait for the first row to be added
	await expect(table.getByText(books[1].isbn).first()).toBeVisible();

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");

	// Check the quantity is updated before...
	await expect(firstRow.getByRole("cell", { name: "2" }).first()).toBeVisible();

	// ... moving to compare
	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(page.getByText("Total delivered:")).toBeVisible();

	//unmatched book => book[1]
	await expect(table.getByRole("row").getByText("Unmatched Books")).toBeVisible();
	await expect(table.getByRole("row").nth(2).getByRole("cell", { name: books[1].isbn })).toBeVisible();

	// placed supplier order books => book[0] book[2]
	await expect(table.getByRole("row").nth(3).getByRole("cell", { name: "sup1" })).toBeVisible();
	await expect(table.getByRole("row").nth(4).getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(table.getByRole("row").nth(5).getByRole("cell", { name: books[2].isbn })).toBeVisible();

	await expect(page.getByText("2 / 2")).toBeVisible();
});

testOrders("should be able to select multiple supplier orders to reconcile at once", async ({ page, books, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	await page.getByText("Ordered").nth(1).click();

	// Select multiple orders via checkboxes
	await page.getByRole("checkbox").nth(1).click();
	await page.getByRole("checkbox").nth(2).click();

	await page.getByText("Reconcile").first().click();

	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	const table = page.getByRole("table");
	const firstMatchedRow = table.getByRole("row").nth(2);
	const secondMatchedRow = table.getByRole("row").nth(3);
	const thirdMatchedRow = table.getByRole("row").nth(4);
	const fourthMatchedRow = table.getByRole("row").nth(5);
	const fifthMatchedRow = table.getByRole("row").nth(6);

	// Scan books from orders
	await expect(table.getByText(placedOrders[0].lines[0].isbn)).toBeVisible();

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	await expect(table.getByText(books[0].isbn)).toBeVisible();

	// Move to comparison view
	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(firstMatchedRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();

	await expect(secondMatchedRow.getByRole("cell", { name: books[2].isbn })).toBeVisible();

	//same book belonging to different supplier order
	await expect(thirdMatchedRow.getByRole("cell", { name: books[2].isbn })).toBeVisible();

	await expect(fourthMatchedRow.getByRole("cell", { name: books[6].isbn })).toBeVisible();

	await expect(fifthMatchedRow.getByRole("cell", { name: books[4].isbn })).toBeVisible();

	// there shouldn't be any unmatched books
	await expect(page.getByText("Unmatched Books")).not.toBeVisible();

	// Verify total delivered count includes books from both orders
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 5")).toBeVisible();
});

testOrders("should be able to continue reconciliation", async ({ page, books, placedOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Scan some books
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	await expect(table.getByText(placedOrders[0].lines[0].isbn)).toBeVisible();

	// Navigate away from the page
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	// Find and click on the "Continue" button for the in-progress reconciliation
	await page.getByRole("button", { name: "Reconciling" }).click();

	await page.getByRole("button", { name: "Continue" }).first().click();

	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	// Verify we can continue scanning
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const firstRow = table.getByRole("row").nth(1);

	// Verify previously scanned books are still present
	await expect(firstRow.getByText(placedOrders[0].lines[0].isbn)).toBeVisible();
	// Verify quantity has increased
	await expect(firstRow.getByRole("cell", { name: "2", exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(table.getByText(books[2].isbn)).toBeVisible();

	// there shouldn't be any unmatched books
	await expect(page.getByText("Unmatched Books")).not.toBeVisible();

	// Verify total delivered count includes all scanned books
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 2")).toBeVisible();
});

testOrders("should be able to commit reconciliation", async ({ page, placedOrders, customers }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// scan ordered book
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	await expect(table.getByText(placedOrders[0].lines[0].isbn)).toBeVisible();

	// compare view
	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	//commit
	await page.getByRole("button", { name: "Commit" }).nth(1).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Confirm" }).click();
	await expect(dialog).not.toBeVisible();

	await page.getByRole("button", { name: "Commit" }).nth(1).click();
	await dialog.getByRole("button", { name: "Confirm" }).click();
	await expect(dialog).not.toBeVisible();
	await page.reload();

	//more assertions to give time for the line to be updated to delivered

	// navigate to customer order view
	await page.goto(`${baseURL}orders/customers/${customers[0].displayId}/`);
	await expect(table.getByText(placedOrders[0].lines[0].isbn)).toBeVisible();
	await expect(table.getByText("Delivered")).toHaveCount(1);
});

testOrders("should handle quantity adjustments correctly", async ({ page, placedOrders }) => {
	// Navigate and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add multiple quantities of same book
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);

	// Verify initial quantity
	await expect(firstRow.getByRole("cell", { name: placedOrders[0].lines[0].isbn, exact: true })).toBeVisible();

	// Increase quantity
	await firstRow.getByRole("button").nth(1).click();
	await expect(firstRow.getByRole("cell", { name: "2", exact: true })).toBeVisible();
});

testOrders("should remove line when quantity reaches zero", async ({ page, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add single quantity
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);

	// Verify initial quantity
	await expect(firstRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();

	// Decrease quantity to zero
	await page.getByLabel("Decrease quantity").click();

	// Verify line is removed
	await expect(firstRow.getByRole("cell", { name: placedOrders[0].lines[0].isbn, exact: true })).not.toBeVisible();
});

testOrders("should handle multiple quantity adjustments", async ({ page, placedOrders, books }) => {
	placedOrders;
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	const secondRow = table.getByRole("row").nth(2);

	// Add multiple books with different quantities
	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	await expect(firstRow.getByRole("cell", { name: books[0].isbn, exact: true })).toBeVisible();

	await isbnInput.fill(books[2].isbn);
	await page.keyboard.press("Enter");
	await expect(secondRow.getByRole("cell", { name: books[2].isbn, exact: true })).toBeVisible();

	// Adjust quantities for both books
	await firstRow.getByRole("button", { name: "Increase quantity" }).dblclick();
	await secondRow.getByRole("button", { name: "Increase quantity" }).click();

	// Verify updated quantities
	await expect(firstRow.getByRole("cell", { name: "3", exact: true })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: "2", exact: true })).toBeVisible();
});

testOrders("should maintain correct totals after multiple quantity adjustments", async ({ page, placedOrders, books }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	await expect(page.getByText(books[0].isbn)).toBeVisible();
	await isbnInput.fill(books[2].isbn);
	await page.keyboard.press("Enter");
	await expect(page.getByText(books[2].isbn)).toBeVisible();

	// Move to compare view
	await page.getByRole("button", { name: "Compare" }).first().click();

	// Initial total
	await expect(page.getByText(`2 / ${placedOrders[0].lines.length}`)).toBeVisible();

	await page.getByRole("button", { name: "Populate" }).first().click();

	// Adjust quantities for all books
	await page.getByRole("table").getByRole("row").all();

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	const secondRow = table.getByRole("row").nth(2);

	await firstRow.getByLabel("Increase quantity").dblclick();

	await secondRow.getByLabel("Decrease quantity").click();

	await page.getByRole("button", { name: "Compare" }).first().click();

	// Verify updated total
	await expect(page.getByText(`3 / ${placedOrders[0].lines.length}`)).toBeVisible();
});

testOrders("should allow supplier orders to be reconciled again after deletion", async ({ page, books, placedOrders }) => {
	books;
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();

	// Select multiple orders
	await page.getByRole("checkbox").nth(1).click();
	await page.getByRole("checkbox").nth(2).click();
	await page.getByText("Reconcile").first().click();

	// Add scanned books
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	// Delete and verify all supplier orders can be reconciled again
	await page.getByRole("button", { name: "Delete reconciliatoin order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Verify back at supplier orders

	await page.reload();

	// Should be able to start new reconciliation with same orders
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByRole("checkbox").nth(2).click();
	await page.getByText("Reconcile").first().click();
});

testOrders("should not delete reconciliation order when canceling deletion", async ({ page, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Add some scanned books
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	// Try to delete but cancel
	await page.getByRole("button", { name: "Delete reconciliatoin order" }).click();
	await page.getByRole("button", { name: "Cancel" }).click();

	// Verify we're still on reconciliation page
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
	// Verify scanned books still present
	await expect(page.getByText(placedOrders[0].lines[0].isbn)).toBeVisible();
});

testOrders("should allow deletion after comparing books", async ({ page, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Add books and go to compare view
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await page.getByRole("button", { name: "Compare" }).click();

	// Delete from compare view
	await page.getByRole("button", { name: "Delete reconciliatoin order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Verify back at supplier orders
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();
});

testOrders("should allow deletion of empty reconciliation order", async ({ page, placedOrders, books }) => {
	books;
	placedOrders;
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Delete without scanning any books
	await page.getByRole("button", { name: "Delete reconciliatoin order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Verify back at supplier orders
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();
});

testOrders("should navigate correctly after deletion", async ({ page, placedOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Add some books
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(placedOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	// Delete and verify navigation
	await page.getByRole("button", { name: "Delete reconciliatoin order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Should be at supplier orders page

	// Verify supplier orders are shown correctly
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();
	await expect(page.getByRole("checkbox").nth(1)).toBeVisible();
});
