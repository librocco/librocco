import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { testOrders } from "@/helpers/fixtures";

testOrders("create: single order: on row button click", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("button", { name: "Reconcile" })
		.click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of delivered books").waitFor();
});

testOrders("create: multiple orders: using checkboxes and a global 'Reconcile' button", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByRole("button", { name: "Reconcile" }).first().click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of delivered books").waitFor();
});

testOrders("create: adds the created reconciliation order to (active) 'Reconciling' tab", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	// 'Reconiling' tab is disabled - no acrive reconciliation orders
	const reconcilingBtn = page.getByRole("button", { name: "Reconciling", exact: true });
	await expect(reconcilingBtn).toBeDisabled();

	// Create an order
	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("button", { name: "Reconcile" })
		.click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of delivered books").waitFor();

	// Navigate back to supplier orders
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	// Navigate to reconiling view
	await reconcilingBtn.click();

	// There should be one row - active reconciliation order (containing 'Continue' button)
	await table.getByRole("row").getByRole("button", { name: "Continue" }).waitFor();
});

testOrders("create: doesn't allow for reconciling same supplier order(s) twice", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	// 'Reconiling' tab is disabled - no acrive reconciliation orders
	const reconcilingBtn = page.getByRole("button", { name: "Reconciling", exact: true });
	await expect(reconcilingBtn).toBeDisabled();

	// Create an order
	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByRole("button", { name: "Reconcile" }).first().click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of delivered books").waitFor();

	// Navigate back to supplier orders
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// The orders being reconciled are currently not displayed in the table
	await relevantOrders.waitFor({ state: "detached" });
});

testOrders("delete: doesn't delete the reconciliation order on cancel", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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
	const l1 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
	const l2 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[1].isbn });

	// Scan each line once
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await l1.waitFor();

	await isbnInput.fill(supplierOrders[0].lines[1].isbn);
	await page.keyboard.press("Enter");
	await l2.waitFor();

	// Open delete dialog and cancel it
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();

	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Cancel" }).click();
	await dialog.waitFor({ state: "detached" });

	// Reload the page and check if the reconciliation order is still there
	await page.reload();

	await l1.waitFor();
	await l2.waitFor();
});

testOrders("delete: deletes the order (and navigates back to supplier orders) on confirm", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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
	const l1 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
	const l2 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[1].isbn });

	// Scan each line once
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await l1.waitFor();

	await isbnInput.fill(supplierOrders[0].lines[1].isbn);
	await page.keyboard.press("Enter");
	await l2.waitFor();

	// Delete the order
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();

	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Confirm" }).click();
	await dialog.waitFor({ state: "detached" });

	// Should navigate to supplier orders
	await page.getByRole("button", { name: "Ordered", exact: true }).click();
	// Check that all supplier orders are there (including the reconciliation-attempted one)
	const allSuppliers = [...new Set(supplierOrders.map(({ order: { supplier_name } }) => supplier_name))];
	const orderRow = table.getByRole("row").filter({ hasText: new RegExp(`(${allSuppliers.join("|")})`) });
	// 3 supplier orders
	await expect(orderRow).toHaveCount(3);

	// Check that 'Reconciling' tab button is disabled - no active reconciliation orders
	await expect(page.getByRole("button", { name: "Reconciling", exact: true })).toBeDisabled();
});

testOrders("delete: allows deletion of an empty reconciliation order", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	// No scanning, just delete the order
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();

	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Confirm" }).click();
	await dialog.waitFor({ state: "detached" });

	// Should navigate to supplier orders
	await page.getByRole("button", { name: "Ordered", exact: true }).click();
	// Check that all supplier orders are there (including the reconciliation-attempted one)
	const allSuppliers = [...new Set(supplierOrders.map(({ order: { supplier_name } }) => supplier_name))];
	const orderRow = table.getByRole("row").filter({ hasText: new RegExp(`(${allSuppliers.join("|")})`) });
	// 3 supplier orders
	await expect(orderRow).toHaveCount(3);

	// Check that 'Reconciling' tab button is disabled - no active reconciliation orders
	await expect(page.getByRole("button", { name: "Reconciling", exact: true })).toBeDisabled();
});

testOrders("populate: initial state", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	// The table shouldn't be there as intial state
	await expect(page.getByText(supplierOrders[0].lines[0].isbn)).not.toBeVisible();
});

testOrders("populate: aggregates the quantity for scanned books", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	// NOTE: At the time of this writing, the orders shared a book with ISBN "5678" (book[2]), this is here
	// to ensure ALL lines get aggregated at this stage (the difference isn't made until the 'compare' stage)
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	// Scan three books with the same isbn
	//
	// NOTE: The l1 and l2 order is arbitraty and doesn't repreesent some expected ordering in the UI
	const l1 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: books[0].isbn, exact: true }) });
	// NOTE: At the time of this writing, this book was present in both supplier orders
	const l2 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: books[2].isbn, exact: true }) });

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	await l1.getByRole("cell", { name: "1", exact: true }).waitFor(); // Check the quantity

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	await l1.getByRole("cell", { name: "2", exact: true }).waitFor(); // Check the quantity

	await isbnInput.fill(books[2].isbn);
	await page.keyboard.press("Enter");
	await l2.getByRole("cell", { name: "1", exact: true }).waitFor(); // Check the quantity

	await isbnInput.fill(books[2].isbn);
	await page.keyboard.press("Enter");
	await l2.getByRole("cell", { name: "2", exact: true }).waitFor(); // Check the quantity

	await isbnInput.fill(books[2].isbn);
	await page.keyboard.press("Enter");
	await l2.getByRole("cell", { name: "3", exact: true }).waitFor(); // Check the quantity

	// Verify the final state, just to make sure
	await l1.getByRole("cell", { name: "2", exact: true }).waitFor();
	await l2.getByRole("cell", { name: "3", exact: true }).waitFor();
});

testOrders("populate: adjusts quantity using the +/- buttons", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	// Scan some lines to work with
	//
	// NOTE: the following 1 and 2 are arbitrary and don't represent any expected order in which they appear in the UI
	const l1 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: books[0].isbn }) });
	const l2 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: books[1].isbn }) });

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	await l1.waitFor();

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	await l2.waitFor();

	// Increase quantity
	await l1.getByRole("button", { name: "Increase quantity" }).click();
	await l1.getByRole("button", { name: "Increase quantity" }).click();
	await l1.getByRole("button", { name: "Increase quantity" }).click();

	await l2.getByRole("button", { name: "Increase quantity" }).click();
	await l2.getByRole("button", { name: "Increase quantity" }).click();

	// Verify the quantities
	await l1.getByRole("cell", { name: "4", exact: true }).waitFor();
	await l2.getByRole("cell", { name: "3", exact: true }).waitFor();

	// Decrease the quantity
	await l1.getByRole("button", { name: "Decrease quantity" }).click();

	await l2.getByRole("button", { name: "Decrease quantity" }).click();
	await l2.getByRole("button", { name: "Decrease quantity" }).click();

	// Verify the quantities
	await l1.getByRole("cell", { name: "3", exact: true }).waitFor();
	await l2.getByRole("cell", { name: "1", exact: true }).waitFor();
});

testOrders("populate: removes a line when quantity drops to 0", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	// Scan some lines to work with
	//
	// NOTE: the following 1 and 2 are arbitrary and don't represent any expected order in which they appear in the UI
	const l1 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: books[0].isbn }) });
	const l2 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: books[1].isbn }) });

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	await l1.waitFor();

	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	await l2.waitFor();

	// Decrease line 1 to 0
	await l1.getByRole("button", { name: "Decrease quantity" }).click();

	// Verify the state
	await l1.waitFor({ state: "detached" });
	await l2.getByRole("cell", { name: "1", exact: true }).waitFor();
});

testOrders("populate: sorts books by ISBN", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	// Scan book 1 (at the time of this writing - alphabetically first ISBN)
	// Scan three books with the same isbn
	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[0].isbn, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Scan book 2
	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Matcher for rows with isbn of book 1 or book 2 - to save some typing
	const isbnRegex = new RegExp(`(${books[0].isbn}|${books[1].isbn})`);
	const scannedRow = table.getByRole("row").filter({ hasText: isbnRegex });

	// Check the ordering
	await expect(scannedRow).toHaveCount(2);
	await scannedRow.nth(0).getByRole("cell", { name: books[0].isbn, exact: true }).waitFor();
	await scannedRow.nth(1).getByRole("cell", { name: books[1].isbn, exact: true }).waitFor();

	// Add one more of each book, in reverse order (ordering shouldn't change)
	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");
	// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: books[1].isbn, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
		.waitFor();

	// Check the ordering
	await expect(scannedRow).toHaveCount(2);
	await scannedRow.nth(0).getByRole("cell", { name: books[0].isbn, exact: true }).waitFor();
	await scannedRow.nth(1).getByRole("cell", { name: books[1].isbn, exact: true }).waitFor();
});

testOrders(
	"populate: persists the state (reconciliation can be continued after navigating away and back)",
	async ({ page, supplierOrders }) => {
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const table = page.getByRole("table");

		await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

		// Scan one book
		await isbnInput.fill(supplierOrders[0].lines[0].isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }) })
			.getByRole("cell", { name: "1", exact: true })
			.waitFor();

		// Navigate away from the page
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		// Navigate to the existing reconciliation order
		await page.getByRole("button", { name: "Reconciling", exact: true }).click();
		// NOTE: there's only one reconciliation note in progress - no need for fine grained matching
		await page.getByRole("button", { name: "Continue", exact: true }).click();

		// Scan one more of the existing line
		await isbnInput.fill(supplierOrders[0].lines[0].isbn);
		await page.keyboard.press("Enter");

		// Verify final state (the line should have scanned quantity: 2 - 1 on first go, 1 added just now)
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: "2", exact: true }) })
			.waitFor();
	}
);

testOrders(
	"compare: empty state: shows all lines for the respective order, case: single order",
	async ({ page, books, supplierOrders }) => {
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const table = page.getByRole("table");

		await page.getByRole("button", { name: "Ordered", exact: true }).click();

		// NOTE: using the first order (from the fixture) for the test
		const { order } = supplierOrders[0];
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
			.getByRole("checkbox")
			.click();

		await page.getByText("Reconcile").first().click();

		// NOTE: Not scanning anything - straight to compare -- we need to use the top tab (the button is invisible)
		await page.getByRole("button", { name: "Compare" }).click();

		// NOTE: the lines we're interested in will be either:
		//   - the subheader - supplier name
		//   - the scanned lines
		//
		// Build a regex to match
		// NOTE: we're always matching for all books and all headings - this implicitly checks that no unexpected rows are shown
		const headerText = [...new Set(["Unmatched Books", ...supplierOrders.map(({ order }) => order.supplier_name)])].join("|");
		const isbnText = [...new Set(books.map(({ isbn }) => isbn))].join("|");
		const matchRegex = new RegExp(`(${headerText}|${isbnText})`);

		const rows = table.getByRole("row").filter({ hasText: matchRegex });

		// Wait for the rows to be displayed
		// NOTE: At the time of this writing there is 1 header (supplier name) + 2 order lines = 3 lines
		await expect(rows).toHaveCount(3);

		// Check the ordering (NOTE: This is the state at the time of this writing)
		// NOTE: the lines should indicate the number of books ordered for each isbn
		//
		// header: sup1
		// line: 5678, quantity (ordered): 3 -- supplierOrders[0].lines[0]
		// line: 7777, quantity (ordered): 1 -- supplierOrders[0].lines[2]
		// line: 9999, quantity (ordered): 2 -- supplierOrders[0].lines[1]
		await rows.nth(0).getByText(supplierOrders[0].order.supplier_name).waitFor();

		await rows.nth(1).getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }).waitFor();
		await rows.nth(1).getByRole("cell", { name: supplierOrders[0].lines[0].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(2).getByRole("cell", { name: supplierOrders[0].lines[1].isbn, exact: true }).waitFor();
		await rows.nth(2).getByRole("cell", { name: supplierOrders[0].lines[1].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		// Check stats: 0 delivered / 3 ordered
		await expect(page.getByText("Total delivered:")).toBeVisible();
		await expect(page.getByText("0 / 3")).toBeVisible();
	}
);

testOrders(
	"compare: empty state: shows all lines for the respective order, case: multiple orders, same supplier",
	async ({ page, books, supplierOrders }) => {
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const table = page.getByRole("table");

		await page.getByRole("button", { name: "Ordered", exact: true }).click();

		// NOTE: using the first two orders (from the fixture)
		// NOTE: At the time of this writing, first two orders belonged to the same supplier
		const relevantOrders = table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
		await relevantOrders.nth(0).getByRole("checkbox").click();
		await relevantOrders.nth(1).getByRole("checkbox").click();

		await page.getByText("Reconcile").first().click();

		// NOTE: Not scanning anything - straight to compare -- we need to use the top tab (the button is invisible)
		await page.getByRole("button", { name: "Compare" }).click();

		// NOTE: the lines we're interested in will be either:
		//   - the subheader - supplier name
		//   - the scanned lines
		//
		// Build a regex to match
		// NOTE: we're always matching for all books and all headings - this implicitly checks that no unexpected rows are shown
		const headerText = [...new Set(["Unmatched Books", ...supplierOrders.map(({ order }) => order.supplier_name)])].join("|");
		const isbnText = [...new Set(books.map(({ isbn }) => isbn))].join("|");
		const matchRegex = new RegExp(`(${headerText}|${isbnText})`);

		const rows = table.getByRole("row").filter({ hasText: matchRegex });

		// Wait for the rows to be displayed
		// NOTE: At the time of this writing there is 1 header (supplier 1) + 5 order lines (2 for order 1 and 3 for order 2) = 6 lines
		await expect(rows).toHaveCount(6);

		// Check the ordering (NOTE: This is the state at the time of this writing)
		// NOTE: the lines should indicate the number of books ordered for each isbn
		//
		// header: sup1
		// line: 1234, quantity (ordered): 2 -- supplierOrders[0].lines[0]
		// line: 5678, quantity (ordered): 1 -- supplierOrders[0].lines[1]
		// line: 5678, quantity (ordered): 3 -- supplierOrders[1].lines[0]
		// line: 7777, quantity (ordered): 1 -- supplierOrders[1].lines[2]
		// line: 9999, quantity (ordered): 2 -- supplierOrders[1].lines[1]
		await rows.nth(0).getByText(supplierOrders[0].order.supplier_name).waitFor();

		await rows.nth(1).getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }).waitFor();
		await rows.nth(1).getByRole("cell", { name: supplierOrders[0].lines[0].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(2).getByRole("cell", { name: supplierOrders[0].lines[1].isbn, exact: true }).waitFor();
		await rows.nth(2).getByRole("cell", { name: supplierOrders[0].lines[1].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(3).getByRole("cell", { name: supplierOrders[1].lines[0].isbn, exact: true }).waitFor();
		await rows.nth(3).getByRole("cell", { name: supplierOrders[1].lines[0].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(4).getByRole("cell", { name: supplierOrders[1].lines[2].isbn, exact: true }).waitFor();
		await rows.nth(4).getByRole("cell", { name: supplierOrders[1].lines[2].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(5).getByRole("cell", { name: supplierOrders[1].lines[1].isbn, exact: true }).waitFor();
		await rows.nth(5).getByRole("cell", { name: supplierOrders[1].lines[1].quantity.toString(), exact: true }).waitFor(); // ordered quantity
	}
);

testOrders(
	"compare: empty state: shows all lines for the respective order, case: multiple orders, muliple suppliers",
	async ({ page, books, supplierOrders }) => {
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const table = page.getByRole("table");

		await page.getByRole("button", { name: "Ordered", exact: true }).click();

		// Check all of the boxes (reconcile all 3 at once)
		await table.getByRole("row").getByRole("checkbox").nth(0).click();
		await table.getByRole("row").getByRole("checkbox").nth(1).click();
		await table.getByRole("row").getByRole("checkbox").nth(2).click();

		await page.getByText("Reconcile").first().click();

		// NOTE: Not scanning anything - straight to compare -- we need to use the top tab (the button is invisible)
		await page.getByRole("button", { name: "Compare" }).click();

		// NOTE: the lines we're interested in will be either:
		//   - the subheader - supplier name
		//   - the scanned lines
		//
		// Build a regex to match
		// NOTE: we're always matching for all books and all headings - this implicitly checks that no unexpected rows are shown
		const headerText = [...new Set(["Unmatched Books", ...supplierOrders.map(({ order }) => order.supplier_name)])].join("|");
		const isbnText = [...new Set(books.map(({ isbn }) => isbn))].join("|");
		const matchRegex = new RegExp(`(${headerText}|${isbnText})`);

		const rows = table.getByRole("row").filter({ hasText: matchRegex });

		// Wait for the rows to be displayed
		// NOTE: At the time of this writing there are 2 header (supplier 1 and 2) + 8 order lines in total = 10 lines
		await expect(rows).toHaveCount(10);

		// Check the ordering (NOTE: This is the state at the time of this writing)
		// NOTE: the lines should indicate the number of books ordered for each isbn
		//
		// header: sup1
		// line: 1234, quantity (ordered): 2 -- supplierOrders[0].lines[0]
		// line: 5678, quantity (ordered): 1 -- supplierOrders[0].lines[1]
		// line: 5678, quantity (ordered): 3 -- supplierOrders[1].lines[0]
		// line: 7777, quantity (ordered): 1 -- supplierOrders[1].lines[2]
		// line: 9999, quantity (ordered): 2 -- supplierOrders[1].lines[1]
		//
		// header: sup2
		// line: 4321, quantity (ordered): 1 -- supplierOrders[2].lines[0]
		// line: 8765, quantity (ordered): 1 -- supplierOrders[2].lines[1]
		// line: 8888, quantity (ordered): 1 -- supplierOrders[2].lines[2]
		await rows.nth(0).getByText(supplierOrders[0].order.supplier_name).waitFor();

		await rows.nth(1).getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }).waitFor();
		await rows.nth(1).getByRole("cell", { name: supplierOrders[0].lines[0].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(2).getByRole("cell", { name: supplierOrders[0].lines[1].isbn, exact: true }).waitFor();
		await rows.nth(2).getByRole("cell", { name: supplierOrders[0].lines[1].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(3).getByRole("cell", { name: supplierOrders[1].lines[0].isbn, exact: true }).waitFor();
		await rows.nth(3).getByRole("cell", { name: supplierOrders[1].lines[0].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(4).getByRole("cell", { name: supplierOrders[1].lines[2].isbn, exact: true }).waitFor();
		await rows.nth(4).getByRole("cell", { name: supplierOrders[1].lines[2].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(5).getByRole("cell", { name: supplierOrders[1].lines[1].isbn, exact: true }).waitFor();
		await rows.nth(5).getByRole("cell", { name: supplierOrders[1].lines[1].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(6).getByText(supplierOrders[2].order.supplier_name).waitFor();

		await rows.nth(7).getByRole("cell", { name: supplierOrders[2].lines[0].isbn, exact: true }).waitFor();
		await rows.nth(7).getByRole("cell", { name: supplierOrders[2].lines[0].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(8).getByRole("cell", { name: supplierOrders[2].lines[1].isbn, exact: true }).waitFor();
		await rows.nth(8).getByRole("cell", { name: supplierOrders[2].lines[1].quantity.toString(), exact: true }).waitFor(); // ordered quantity

		await rows.nth(9).getByRole("cell", { name: supplierOrders[2].lines[2].isbn, exact: true }).waitFor();
		await rows.nth(9).getByRole("cell", { name: supplierOrders[2].lines[2].quantity.toString(), exact: true }).waitFor(); // ordered quantity
	}
);

testOrders(
	"compare: unmatched orders are shown at the top of the list (namespaced as 'Unmatched')",
	async ({ page, books, supplierOrders }) => {
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const table = page.getByRole("table");

		await page.getByRole("button", { name: "Ordered", exact: true }).click();

		// NOTE: using the first order (from the fixture) for the test
		const { order } = supplierOrders[0];
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
			.getByRole("checkbox")
			.click();

		await page.getByText("Reconcile").first().click();

		// Scan 1 book not belonging to the order (NOTE: at the time of this wrigint, books[4] is not part of the order)
		const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
		await isbnInput.fill(books[4].isbn);
		await page.keyboard.press("Enter");
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: books[4].isbn }) })
			.waitFor();

		await page.getByRole("button", { name: "Compare", exact: true }).click();

		// NOTE: the lines we're interested in will be either:
		//   - the subheader - supplier name
		//   - the scanned lines
		//
		// Build a regex to match
		// NOTE: we're always matching for all books and all headings - this implicitly checks that no unexpected rows are shown
		const headerText = [...new Set(["Unmatched Books", ...supplierOrders.map(({ order }) => order.supplier_name)])].join("|");
		const isbnText = [...new Set(books.map(({ isbn }) => isbn))].join("|");
		const matchRegex = new RegExp(`(${headerText}|${isbnText})`);

		const rows = table.getByRole("row").filter({ hasText: matchRegex });

		// Wait for the rows to be displayed
		// NOTE: At the time of this writing there are 2 headers (unmatched and supplier 1) + 3 order lines in total = 5 lines
		await expect(rows).toHaveCount(5);

		// Check the ordering (NOTE: This is the state at the time of this writing)
		// NOTE: the lines should indicate the number of books ordered for each isbn
		//
		// header: Unmatched Books
		// line: 9999 -- books[4]
		//
		// header: sup1
		// line: 1234 -- supplierOrders[0].lines[0]
		// line: 5678 -- supplierOrders[0].lines[1]
		await rows.nth(0).getByText("Unmatched Books").waitFor();
		await rows.nth(1).getByRole("cell", { name: books[4].isbn, exact: true }).waitFor();
		await rows.nth(2).getByText(supplierOrders[0].order.supplier_name).waitFor();
		await rows.nth(3).getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }).waitFor();
		await rows.nth(4).getByRole("cell", { name: supplierOrders[0].lines[1].isbn, exact: true }).waitFor();
	}
);

testOrders("compare: overdelivered books should be shown in the 'Unmatched' section", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	// Add 1 more line 1 than ordered
	// NOTE: At the time of this wrting, order 1 - line 1 had ordered quantity of 2
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	// Wait for the line to appear
	const lineRow = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
	await lineRow.getByRole("cell", { name: "1", exact: true }).waitFor();

	// Add 2 more
	await lineRow.getByRole("button", { name: "Increase quantity" }).click();
	await lineRow.getByRole("button", { name: "Increase quantity" }).click();

	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// NOTE: the lines we're interested in will be either:
	//   - the subheader - supplier name
	//   - the scanned lines
	//
	// Build a regex to match
	// NOTE: we're always matching for all books and all headings - this implicitly checks that no unexpected rows are shown
	const headerText = [...new Set(["Unmatched Books", ...supplierOrders.map(({ order }) => order.supplier_name)])].join("|");
	const isbnText = [...new Set(books.map(({ isbn }) => isbn))].join("|");
	const matchRegex = new RegExp(`(${headerText}|${isbnText})`);

	const rows = table.getByRole("row").filter({ hasText: matchRegex });

	// Wait for the rows to be displayed
	// NOTE: At the time of this writing there are 2 headers (unmatched and supplier 1) + 3 order lines in total (1 overdelivered, 2 from the order) = 5 lines
	await expect(rows).toHaveCount(5);

	// Check the ordering (NOTE: This is the state at the time of this writing)
	// NOTE: the lines should indicate the number of books ordered for each isbn
	//
	// header: Unmatched Books
	// line: 1234 -- supplierOrders[0].lines[0] (overdelivered)
	//
	// header: sup1
	// line: 1234 -- supplierOrders[0].lines[0]
	// line: 5678 -- supplierOrders[0].lines[1]
	await rows.nth(0).getByText("Unmatched Books").waitFor();
	await rows.nth(1).getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }).waitFor();
	await rows.nth(2).getByText(supplierOrders[0].order.supplier_name).waitFor();
	await rows.nth(3).getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }).waitFor();
	await rows.nth(4).getByRole("cell", { name: supplierOrders[0].lines[1].isbn, exact: true }).waitFor();
});

testOrders("should show correct comparison when quantities match ordered amounts", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

testOrders("should show over-delivery when scanned quantities are more than ordered amounts", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

		await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	await page.getByRole("button", { name: "Ordered", exact: true }).click();
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
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

testOrders("should be able to commit reconciliation", async ({ page, customers, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

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

	//more assertions to give time for the line to be updated to delivered

	// navigate to customer order view
	await page.goto(`${baseURL}orders/customers/${customers[0].displayId}/`);
	await expect(table.getByText(supplierOrders[0].lines[0].isbn)).toBeVisible();
	await expect(table.getByText("Delivered")).toHaveCount(1);
});
