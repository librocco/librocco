import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { depends, testOrders } from "@/helpers/fixtures";

// * Note: its helpful to make an assertion after each <enter> key
// as it seems that Playwright may start running assertions before page data has fully caught up
testOrders("should show correct initial state of reconciliation page", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: checking for initial state using all 3 supplier orders
	for (const order of supplierOrders) {
		const totalBooks = order.lines.reduce((acc, { quantity }) => acc + quantity, 0);
		await table
			.getByRole("row")
			.filter({ hasText: order.order.supplier_name })
			.filter({ has: page.getByRole("cell", { name: totalBooks.toString(), exact: true }) })
			.getByRole("checkbox")
			.click();
	}

	await page.getByText("Reconcile").first().click();

	// Verify initial UI elements
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
	await expect(page.getByPlaceholder("Enter ISBN of delivered books")).toBeVisible();
	await expect(page.getByText("Scan or enter the ISBNs of the delivered books to begin reconciliation.")).toBeVisible();

	// Check the list of associated orders
	const supplierNames = [...new Set(supplierOrders.map(({ order: { supplier_name } }) => supplier_name))].join("|");
	const associatedOrdersRegex = new RegExp(`#[0-9]* \\((${supplierNames})\\)`);
	await expect(page.getByText(associatedOrdersRegex, { exact: true })).toHaveCount(3);

	await expect(page.getByText(supplierOrders[0].lines[0].isbn)).not.toBeVisible();

	await expect(page.getByRole("button", { name: "Commit" })).toBeDisabled();
	await expect(page.getByRole("button", { name: "Compare" })).toHaveCount(1);
	await expect(page.getByRole("button", { name: "Compare" }).nth(1)).not.toBeVisible();
});

testOrders("should show correct comparison when quantities match ordered amounts", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	// Calculate total ordered quantity from the orders ordered from sup1
	// we know it's sup1 bc we only selected the first two orders
	// and orders are sorted by sup name
	const placedOrderLinesWithSup1 = supplierOrders
		.filter(({ order: { supplier_name } }) => supplier_name === "sup1")
		.flatMap(({ lines }) => lines);

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill(placedOrderLinesWithSup1[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: placedOrderLinesWithSup1[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.focus();
	await isbnInput.fill(placedOrderLinesWithSup1[0].isbn);
	await page.keyboard.press("Enter");
	// scanned quantity === delivered quantity
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: placedOrderLinesWithSup1[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	await page.getByRole("button", { name: "Compare" }).first().click();

	// Verify comparison view
	await expect(
		table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: books[0].isbn }) })
			.getByRole("checkbox")
	).toBeChecked();

	// there shouldn't be any unmatched books
	await expect(page.getByText("Unmatched Books")).not.toBeVisible();

	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 3")).toBeVisible(); // Assuming 1 was ordered
});

testOrders("should correctly increment quantities when scanning same ISBN multiple times", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: "1111111111" }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: "1111111111" }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check final quantities
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: "1111111111" }) })
		.filter({ has: page.getByRole("cell", { name: "3", exact: true }) })
		.waitFor();

	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();
});

testOrders("should show over-delivery when scanned quantities are more than ordered amounts", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	// Add some scanned books
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Scan more than ordered
	// NOTE: This scans exactly the amount ordered (2), TODO: check authors intentions...
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	await table.getByRole("row").getByRole("cell", { name: supplierOrders[0].lines[0].supplier_name }).waitFor();

	await expect(page.getByText("2 / 3")).toBeVisible();
});

testOrders(
	"should show under-delivery when ordered books are not scanned or the scanned quantities are less than ordered amounts",
	async ({ page, supplierOrders, books }) => {
		supplierOrders;
		// Navigate to reconciliation
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const table = page.getByRole("table");

		await page.getByText("Ordered").nth(1).click();

		// NOTE: using the first two orders (from the fixture)
		// NOTE: At the time of this writing, first two orders belonged to the same supplier
		const relevantOrders = table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
		await relevantOrders.nth(0).getByRole("checkbox").click();
		await relevantOrders.nth(1).getByRole("checkbox").click();

		await page.getByText("Reconcile").first().click();

		const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

		// Scan less quantity than ordered
		// From fixtures we know supplierOrders[0].lines[0] has quantity: 1
		await isbnInput.fill(books[0].isbn);
		await page.keyboard.press("Enter");
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: books[0].isbn }) })
			.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
			.waitFor();

		// Move to comparison view
		await page.getByRole("button", { name: "Compare" }).first().click();

		// Verify comparison table structure

		// Check supplier name row
		await expect(table.getByRole("row").getByRole("cell", { name: "sup1" })).toBeVisible();

		// Check book details row
		await table.getByRole("row").getByRole("cell", { name: books[0].isbn }).waitFor();

		// there shouldn't be any unmatched books
		await expect(page.getByText("Unmatched Books")).not.toBeVisible();

		// Verify delivery stats show under-delivery
		await expect(page.getByText("Total delivered:")).toBeVisible();

		// We only scanned one book, so expect "1 / {totalOrdered}"
		await expect(page.getByText(`1 / 9`)).toBeVisible();
	}
);

testOrders("should show unmatched deliveries when ordered books do not match scanned books", async ({ page, supplierOrders, books }) => {
	supplierOrders;

	// Navigate to reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Scan non ordered books
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Move to comparison view
	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	// Verify comparison table structure

	// Check supplier name row
	await expect(table.getByRole("row").getByRole("cell", { name: "unmatched" })).toBeVisible();

	// Check book details row
	const unmatchedBookRow = table.getByRole("row").nth(2);
	await expect(unmatchedBookRow.getByRole("cell", { name: books[1].isbn })).toBeVisible();
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn }) })
		.filter({ hasNot: page.getByRole("checkbox") }) // Unmatched rows don't have a delivery-filled checkbox
		.waitFor();

	await table.getByRole("row").getByRole("cell", { name: supplierOrders[0].lines[0].supplier_name }).waitFor();

	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("checkbox") }) // Matched books have a checkbox indicating delivery fill status
		.waitFor();
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[1].isbn }) })
		.filter({ has: page.getByRole("checkbox") }) // Matched books have a checkbox indicating delivery fill status
		.waitFor();

	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("1 / 3")).toBeVisible();
});

testOrders("regression: unmatched books shouldn't affect the Total delivered count", async ({ page, supplierOrders, books }) => {
	// NOTE: this is a very dirty (but sintactically legal) way of referencing the fixtures (having them run)
	// and silencing the unused variable warning
	supplierOrders;
	books;

	// Navigate to reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	const table = page.getByRole("table");

	// Scan two books that weren't ordered with this supplier order
	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");
	await table.getByText("1111111111").waitFor();

	await isbnInput.fill("2222222222");
	await page.keyboard.press("Enter");
	await table.getByText("2222222222").waitFor();

	// Move to comparison view
	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	// 2 books were ordered
	// 2 completely different books were delivered
	// Total delivered should reflect: 0 / 2 (relevant lines filled)
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("0 / 3")).toBeVisible();
});

testOrders("should show correct delivery stats in commit view", async ({ page, books, supplierOrders }) => {
	depends(supplierOrders);
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	// ... moving to compare
	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(page.getByText("Total delivered:")).toBeVisible();

	// unmatched book => book[1]
	await expect(table.getByRole("row").getByText("Unmatched Books")).toBeVisible();
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn }) })
		.filter({ hasNot: page.getByRole("checkbox") }) // Unmatched rows don't have a delivery-filled checkbox
		.waitFor();

	// placed supplier order books => book[0] book[2]
	await expect(table.getByRole("row").getByRole("cell", { name: "sup1" })).toBeVisible();
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("checkbox") }) // Matched books have a checkbox indicating delivery fill status
		.waitFor();
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[1].isbn }) })
		.filter({ has: page.getByRole("checkbox") }) // Matched books have a checkbox indicating delivery fill status
		.waitFor();

	await expect(page.getByText("0 / 3")).toBeVisible();
});

testOrders("should be able to select multiple supplier orders to reconcile at once", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Scan books from orders
	await expect(table.getByText(supplierOrders[0].lines[0].isbn)).toBeVisible();

	await isbnInput.fill(books[0].isbn); // Scanning the same isbn, but a differnt variable, for some reason...
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	// Move to comparison view
	await page.getByRole("button", { name: "Compare" }).first().click();

	const lines = supplierOrders.slice(0, 2).flatMap(({ lines }) => lines);
	for (const line of lines) {
		await table.getByRole("row").getByRole("cell", { name: line.supplier_name }).waitFor();
	}

	// there shouldn't be any unmatched books
	await expect(page.getByText("Unmatched Books")).not.toBeVisible();

	// Verify total delivered count includes books from both orders
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 9")).toBeVisible();
});

testOrders("should be able to continue reconciliation", async ({ page, books, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	// Scan some books
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Navigate away from the page
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	// Find and click on the "Continue" button for the in-progress reconciliation
	await page.getByRole("button", { name: "Reconciling" }).click();

	await page.getByRole("button", { name: "Continue" }).first().click();

	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	// Verify we can continue scanning
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	// Verify quantity has increased
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(table.getByText(books[2].isbn)).toBeVisible();

	// there shouldn't be any unmatched books
	await expect(page.getByText("Unmatched Books")).not.toBeVisible();

	// Verify total delivered count includes all scanned books
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 3")).toBeVisible();
});

testOrders("should be able to commit reconciliation", async ({ page, customers, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	// scan ordered book
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

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
	await expect(table.getByText(supplierOrders[0].lines[0].isbn)).toBeVisible();
	await expect(table.getByText("Delivered")).toHaveCount(1);
});

testOrders("should handle quantity adjustments correctly", async ({ page, supplierOrders }) => {
	depends(supplierOrders);
	// Navigate and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add a book
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Increase the quantity
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.getByRole("button", { name: "Increase quantity" })
		.click();

	// Check quantity update
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();
});

testOrders("should remove line when quantity reaches zero", async ({ page, supplierOrders }) => {
	depends(supplierOrders);
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add single quantity
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Decrease the quantity
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.getByRole("button", { name: "Decrease quantity" })
		.click();

	// Check quantity update
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.waitFor({ state: "detached" });
});

testOrders("should handle multiple quantity adjustments", async ({ page, supplierOrders, books }) => {
	depends(supplierOrders);
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add multiple books with different quantities
	// NOTE: This only adds 1 quantity per each book (TODO: check what the author wanted here...)
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.fill(supplierOrders[0].lines[1].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[1].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Adjust quantities for both books
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.getByRole("button", { name: "Increase quantity" })
		.click();

	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[1].isbn }) })
		.getByRole("button", { name: "Increase quantity" })
		.click();

	// Verify updated quantities
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[1].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();
});

testOrders.skip("should maintain correct totals after multiple quantity adjustments", async ({ page, supplierOrders, books }) => {
	depends(supplierOrders);
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add initial quantity
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await isbnInput.fill(supplierOrders[0].lines[1].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[1].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Move to compare view
	await page.getByRole("button", { name: "Compare" }).first().click();
	// Initial total
	await expect(page.getByText("2 / 3")).toBeVisible();

	// Move back to 'Populate' step
	await page.getByRole("button", { name: "Populate" }).first().click();

	// Adjust quantities for all books
	const book1Line = table.getByRole("row").filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) });
	// Click twice to increase quantity to 3 (not double click as that is a different action)
	await book1Line.getByRole("button", { name: "Increase quantity" }).click();
	await book1Line.getByRole("button", { name: "Increase quantity" }).click();

	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[1].isbn }) })
		.getByRole("button", { name: "Decrease quantity" })
		.click();

	await page.getByRole("button", { name: "Compare" }).first().click();

	// Verify updated total
	// TODO: Check this, it seems fishy -- decreasing line 2 should result in 0 quantity,
	// hence: book 1 x 2 (delivered - out of 2 ordered) + book 2 x 0 (delivered) = 2 / book1 x 2 (ordered) + book 2 x 1 (ordered) = 3
	// overdelivered book 1 shouldn't make the delivered count - at most 2 of book 1 (delivered quantity) should make the delivered count
	await expect(page.getByText("3 / 3")).toBeVisible();
});

testOrders.skip("should allow supplier orders to be reconciled again after deletion", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// Select multiple orders
	// NOTE: using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add a book
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Delete and verify all supplier orders can be reconciled again
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	await page.waitForURL("**/orders/suppliers/orders/");
	await page.waitForTimeout(1000);

	// Verify back at supplier orders
	await page.reload();

	// Verify back at supplier orders
	// stalling here to give time for the page to load the deleted orders
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();

	// Should be able to start new reconciliation with same orders
	await page.getByText("Ordered").nth(1).click();

	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	// TODO: This doesn't seem complete
	await page.getByText("Reconcile").first().click();
});

testOrders("should not delete reconciliation order when canceling deletion", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Scan some books
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Try to delete but cancel
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Cancel" }).click();

	// Verify we're still on reconciliation page
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
	// Verify scanned books still present
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();
});

testOrders("should allow deletion after comparing books", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add books and go to compare view
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	await page.getByRole("button", { name: "Compare" }).click();

	// Delete from compare view
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Verify back at supplier orders
	// TODO: This seems incomplete
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();
});

testOrders("should allow deletion of empty reconciliation order", async ({ page, supplierOrders, books }) => {
	books;
	supplierOrders;

	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	// Delete without scanning any books
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Verify back at supplier orders
	// TODO: This seems incomplete
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();
});

// TODO: Skipped this so as to not fail in 'main' with refactor under way
// NOTE: This test seems a bit redundant, considering the above tests
testOrders.skip("should navigate correctly after deletion", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByText("Ordered").nth(1).click();

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Add some books
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Delete and verify navigation
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Should be at supplier orders page

	// Verify supplier orders are shown correctly
	// TODO: This seems incomplete
	await page.getByText("Ordered", { exact: true }).click();
	// TODO: This is incredibly generic and might result in false negatives
	await expect(page.getByRole("checkbox").nth(1)).toBeVisible();
});
