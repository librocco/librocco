import { expect } from "@playwright/test";

import { appHash, baseURL } from "@/constants";
import { depends, testOrders } from "@/helpers/fixtures";

testOrders("create: single order: on row button click", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("button", { name: "Reconcile" })
		.click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of ordered books").waitFor();
});

testOrders("create: multiple orders: using checkboxes and a global 'Reconcile' button", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByRole("button", { name: "Reconcile" }).first().click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of ordered books").waitFor();
});

testOrders("create: adds the created reconciliation order to (active) 'Reconciling' tab", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// 'Reconiling' tab is disabled - no active reconciliation orders
	await page.goto(appHash("reconciling"));
	expect(page.getByRole("table").getByRole("row")).toHaveCount(1);

	await page.goto(appHash("ordered"));

	// Create an order

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("button", { name: "Reconcile" })
		.click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of ordered books").waitFor();

	// Navigate to reconiling view
	await page.goto(appHash("reconciling"));

	// There should be one row - active reconciliation order (containing 'Continue' button)
	await table.getByRole("row").getByRole("button", { name: "Continue" }).waitFor();
});

testOrders("create: doesn't allow for reconciling same supplier order(s) twice", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// 'Reconiling' tab is disabled - no acrive reconciliation orders
	await page.goto(appHash("reconciling"));
	expect(page.getByRole("table").getByRole("row")).toHaveCount(1);

	await page.goto(appHash("ordered"));

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByRole("button", { name: "Reconcile" }).first().click();

	// Check that we're at the reconciliation page
	await page.getByPlaceholder("Enter ISBN of ordered books").waitFor();

	// Navigate back to supplier orders
	await page.goto(appHash("ordered"));

	// await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// The orders being reconciled are currently not displayed in the table
	await relevantOrders.waitFor({ state: "detached" });
});

testOrders("delete: doesn't delete the reconciliation order on cancel", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click({ force: true });

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");
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
	//
	// NOTE: In CI the navigation is somewhat broken: you can't navigate to a specific page with dynamic params,
	// so we have to go to a static page (no dynamic params) and navigate from there
	// TODO: Replace the lines below with the commented line(s) when the hash routing is implemented
	//
	// await page.reload();
	await page.goto(appHash("reconciling"));
	await page.getByRole("button", { name: "Continue" }).click(); // NOTE: only active order (no need for fine grained matching)

	await l1.waitFor();
	await l2.waitFor();
});

testOrders("delete: deletes the order (and navigates back to supplier orders) on confirm", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");
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
	await page.goto(appHash("ordered"));

	// Should navigate to supplier orders
	// Check that all supplier orders are there (including the reconciliation-attempted one)
	const allSuppliers = [...new Set(supplierOrders.map(({ order: { supplier_name } }) => supplier_name))];
	const orderRow = table.getByRole("row").filter({ hasText: new RegExp(`(${allSuppliers.join("|")})`) });
	// 3 supplier orders
	await expect(orderRow).toHaveCount(3);

	// Check that 'Reconciling' tab button is disabled - no active reconciliation orders
	await page.goto(appHash("reconciling"));
	expect(page.getByRole("table").getByRole("row")).toHaveCount(1);
});

testOrders("delete: allows deletion of an empty reconciliation order", async ({ page, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	// No scanning, just delete the order
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();

	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Confirm" }).click();
	await dialog.waitFor({ state: "detached" });
	await page.goto(appHash("ordered"));

	// Should navigate to supplier orders
	// Check that all supplier orders are there (including the reconciliation-attempted one)
	const allSuppliers = [...new Set(supplierOrders.map(({ order: { supplier_name } }) => supplier_name))];
	const orderRow = table.getByRole("row").filter({ hasText: new RegExp(`(${allSuppliers.join("|")})`) });
	// 3 supplier orders
	await expect(orderRow).toHaveCount(3);

	// Check that 'Reconciling' tab button is disabled - no active reconciliation orders
	await page.goto(appHash("reconciling"));
	expect(page.getByRole("table").getByRole("row")).toHaveCount(1);
});

testOrders("populate: initial state", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: checking for initial state using all 3 supplier orders
	for (const { order } of supplierOrders) {
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
			.getByRole("checkbox")
			.click();
	}

	await page.getByText("Reconcile").first().click();
	// await page.goto(appHash("reconcile", "9999"));

	// Verify initial UI elements
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
	await expect(page.getByPlaceholder("Enter ISBN of ordered books")).toBeVisible();
	await expect(page.getByText("Scan or enter the ISBNs of the delivered books to begin reconciliation.")).toBeVisible();

	// Check the list of associated orders
	const supplierNames = [...new Set(supplierOrders.map(({ order: { supplier_name } }) => supplier_name))].join("|");
	const associatedOrdersRegex = new RegExp(`#[0-9]* \\((${supplierNames})\\)`);
	await expect(page.getByText(associatedOrdersRegex, { exact: true })).toHaveCount(3);

	await expect(page.getByText(supplierOrders[0].lines[0].isbn)).not.toBeVisible();

	await expect(page.getByRole("button", { name: "Commit" })).toBeDisabled();
	await expect(page.getByRole("button", { name: "Compare", exact: true })).toHaveCount(1);

	// The table shouldn't be there as intial state
	await expect(page.getByText(supplierOrders[0].lines[0].isbn)).not.toBeVisible();
});

testOrders("populate: aggregates the quantity for scanned books", async ({ page, books, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

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

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

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
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

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
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

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
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

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
		await page.goto(appHash("ordered"));

		const table = page.getByRole("table");

		// await page.getByRole("button", { name: "Ordered", exact: true }).click();

		// NOTE: using the first order (from the fixture) for the test
		// (not really relevant for this test, but we want to make sure it's, in fact, an order row, not a header)
		const { order } = supplierOrders[0];
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
			.getByRole("checkbox")
			.click();

		await page.getByText("Reconcile").first().click();

		const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

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
		await page.goto(appHash("reconciling"));

		// Navigate to the existing reconciliation order
		// await page.getByRole("button", { name: "Reconciling", exact: true }).click();
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
		await page.goto(appHash("ordered"));

		const table = page.getByRole("table");

		// NOTE: using the first order (from the fixture) for the test
		const { order } = supplierOrders[0];
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
			.getByRole("checkbox")
			.click();

		await page.getByText("Reconcile").first().click();

		// NOTE: Not scanning anything - straight to compare -- we need to use the top tab (the button is invisible)
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
		await page.goto(appHash("ordered"));

		const table = page.getByRole("table");

		// NOTE: using the first two orders (from the fixture)
		// NOTE: At the time of this writing, first two orders belonged to the same supplier
		const relevantOrders = table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
		await relevantOrders.nth(0).getByRole("checkbox").click();
		await relevantOrders.nth(1).getByRole("checkbox").click();

		await page.getByText("Reconcile").first().click();

		// NOTE: Not scanning anything - straight to compare -- we need to use the top tab (the button is invisible)
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
		await page.goto(appHash("ordered"));

		const table = page.getByRole("table");

		// Check all of the boxes (reconcile all 3 at once)
		await table.getByRole("row").getByRole("checkbox").nth(0).click();
		await table.getByRole("row").getByRole("checkbox").nth(1).click();
		await table.getByRole("row").getByRole("checkbox").nth(2).click();

		await page.getByText("Reconcile").first().click();

		// NOTE: Not scanning anything - straight to compare -- we need to use the top tab (the button is invisible)
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
		await page.goto(appHash("ordered"));

		const table = page.getByRole("table");

		// NOTE: using the first order (from the fixture) for the test
		const { order } = supplierOrders[0];
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
			.getByRole("checkbox")
			.click();

		await page.getByText("Reconcile").first().click();

		// Scan 1 book not belonging to the order (NOTE: at the time of this wrigint, books[4] is not part of the order)
		const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");
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
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

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

testOrders("compare: single order: fully filled", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	// Scan all books belonging to the order
	for (const line of supplierOrders[0].lines) {
		await isbnInput.fill(line.isbn);
		await page.keyboard.press("Enter");

		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		const row = table.getByRole("row").filter({ hasText: line.isbn });
		await row.getByRole("cell", { name: "1", exact: true }).waitFor();

		// Add enough quantity (using the + button)
		// NOTE: upper bound: quantity - 1 -- as we've already added 1 (by scanning)
		for (let i = 0; i < line.quantity - 1; i++) {
			await row.getByRole("button", { name: "Increase quantity" }).click();
		}
	}

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// Both lines should be checked (as in: fully delivered)
	const l1 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
	const l2 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[1].isbn });

	await expect(l1.getByRole("checkbox")).toBeChecked();
	await expect(l2.getByRole("checkbox")).toBeChecked();

	// Total delivered = 3, Total ordered = 3
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("3 / 3")).toBeVisible();
});

testOrders("compare: single order: overdelivery", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	// Scan the books belonging to the order
	for (const line of supplierOrders[0].lines) {
		// NOTE: adding 2 of each book - results in overdelivery for line 2
		await isbnInput.fill(line.isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		const lineRow = table.getByRole("row").filter({ hasText: line.isbn });
		await lineRow.getByRole("cell", { name: "1", exact: true }).waitFor();
		// Add one more
		await lineRow.getByRole("button", { name: "Increase quantity" }).click();
	}

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	const l1 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
	const l2 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[1].isbn });

	// Line 1 should appear once (checked) - fully delivered
	await expect(l1.getByRole("checkbox")).toBeChecked();

	// Line 2 should appear twice
	await expect(l2).toHaveCount(2);
	// Unmatched (that one overdelivered) - no checkbox
	await l2.filter({ hasNot: page.getByRole("checkbox") }).waitFor();
	// Regular line - fully delivered
	await expect(l2.getByRole("checkbox")).toBeChecked();

	// NOTE: the Total delivered shows how many volumes, out of the ordered ones, were scanned (doesn't care about overdelivery)
	// Total delivered (out of ordered books) = 3, Total ordered = 3
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("3 / 3")).toBeVisible();
});

testOrders("compare: single order: partial delivery: no additional books", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	// Scan the books belonging to the order
	for (const line of supplierOrders[0].lines) {
		// NOTE: scanning only one volume per line (regardles of quantity ordered)
		await isbnInput.fill(line.isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		const lineRow = table.getByRole("row").filter({ hasText: line.isbn });
		await lineRow.getByRole("cell", { name: "1", exact: true }).waitFor();
	}

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	const l1 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
	const l2 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[1].isbn });

	// line 1 - Should not be checked - underdelivered
	await expect(l1.getByRole("checkbox")).not.toBeChecked();
	// line 2 - Should be checked - fully delivered
	await expect(l2.getByRole("checkbox")).toBeChecked();

	// Total delivered = 2, Total ordered = 3
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 3")).toBeVisible();
});

testOrders("compare: single order: partial delivery: 1 line overdelivered", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	const l1 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }) });

	// Scan the books
	//
	// Line 1 overdelivered (ordered - 2, scanned - 3), line 2 is not delivered
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await l1.getByRole("cell", { name: "1", exact: true }).waitFor();
	// Add 2 more
	await l1.getByRole("button", { name: "Increase quantity" }).click();
	await l1.getByRole("button", { name: "Increase quantity" }).click();

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// NOTE: Even though 3 books were delivered, only 2 out of those 3 were part of the order,
	// whereas one order line was not delivered, hence 2 / 3
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 3")).toBeVisible();
});

testOrders("compare: single order: partial delivery: 1 unmatched book", async ({ page, books, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	const l1 = table.getByRole("row").filter({ has: page.getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true }) });

	// Scan line 1 fully delivered
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await l1.getByRole("cell", { name: "1", exact: true }).waitFor();
	// Add 1 more (for full delivery)
	await l1.getByRole("button", { name: "Increase quantity" }).click();

	// Scan an unmatched book (not belonging to the order)
	// NOTE: at the time of this writing, books[1] didn't belong to the order used for this test
	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	await table
		.getByRole("row")
		.filter({ hasText: books[1].isbn })
		.filter({ has: page.getByRole("cell", { name: "1", exact: true }) })
		.waitFor();

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// NOTE: Even though 3 books were delivered, only 2 out of those 3 were part of the order,
	// whereas one order line was not delivered, hence 2 / 3
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("2 / 3")).toBeVisible();
});

testOrders("compare: multiple orders: fully filled", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	const [o1, o2] = supplierOrders;

	// Aggregate the lines (quantity) for both orders
	//
	// NOTE: This creates some opacity, I know...but it's the easiest way to scann all of the books,
	// in a situation where one or more ISBNs are shared between orders and avoid errors when matching displayed quantity
	const aggLines = [o1, o2]
		.flatMap(({ lines }) => lines)
		.reduce((acc, { isbn, quantity }) => (acc.set(isbn, (acc.get(isbn) || 0) + quantity), acc), new Map<string, number>());

	for (const [isbn, quantity] of aggLines.entries()) {
		// Add enough quantity
		await isbnInput.fill(isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		const row = table.getByRole("row").filter({ hasText: isbn });
		await row.getByRole("cell", { name: "1", exact: true }).waitFor();

		// Add enough quantity (using the + button)
		// NOTE: upper bound: quantity - 1 -- as we've already added 1 (by scanning)
		for (let i = 0; i < quantity - 1; i++) {
			await row.getByRole("button", { name: "Increase quantity" }).click();
		}
	}

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// Check that all lines have been checked
	const lines = [o1, o2].flatMap(({ lines }) => lines);
	for (const { isbn, quantity } of lines) {
		const line = table
			.getByRole("row")
			.filter({ hasText: isbn })
			.filter({ has: page.getByRole("cell", { name: quantity.toString(), exact: true }) });
		await expect(line.getByRole("checkbox")).toBeChecked();
	}

	// Fully delivered:
	//   - order 1: 2 + 1
	//   - order 2: 3 + 2 + 1
	//   - total = 9
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("9 / 9")).toBeVisible();
});

testOrders("compare: multiple orders: overdelivery", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	const [o1, o2] = supplierOrders;

	// Aggregate the lines (quantity) for both orders
	//
	// NOTE: This creates some opacity, I know...but it's the easiest way to scann all of the books,
	// in a situation where one or more ISBNs are shared between orders and avoid errors when matching displayed quantity
	const aggLines = [o1, o2]
		.flatMap(({ lines }) => lines)
		.reduce((acc, { isbn, quantity }) => (acc.set(isbn, (acc.get(isbn) || 0) + quantity), acc), new Map<string, number>());

	for (const [isbn, quantity] of aggLines.entries()) {
		await isbnInput.fill(isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		const row = table.getByRole("row").filter({ hasText: isbn });
		await row.getByRole("cell", { name: "1", exact: true }).waitFor();

		// Add enough quantity (using the + button)
		// NOTE: upper bound: quantity - 1 -- as we've already added 1 (by scanning)
		for (let i = 0; i < quantity - 1; i++) {
			await row.getByRole("button", { name: "Increase quantity" }).click();
		}
	}

	// Add one more book from the first order (overdelivery)
	await table.getByRole("row").filter({ hasText: o1.lines[0].isbn }).getByRole("button", { name: "Increase quantity" }).click();

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// Check that all lines have been checked
	const lines = [o1, o2].flatMap(({ lines }) => lines);
	for (const { isbn, quantity } of lines) {
		const line = table
			.getByRole("row")
			.filter({ hasText: isbn })
			.filter({ has: page.getByRole("cell", { name: quantity.toString(), exact: true }) });
		await expect(line.getByRole("checkbox")).toBeChecked();
	}
	// There should be one line without the checkbox (overdelivered)
	await expect(table.getByRole("row").filter({ hasText: o1.lines[0].isbn, hasNot: page.getByRole("checkbox") })).toHaveCount(1);

	// Fully delivered:
	//   - order 1: 2 + 1
	//   - order 2: 3 + 2 + 1
	//   - total = 9
	// (The overdelivery doesn't affect the total comparision count)
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("9 / 9")).toBeVisible();
});

testOrders("compare: multiple orders: partial delivery: no additional books", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	const [o1, o2] = supplierOrders;

	// Scan every book once
	const isbns = new Set([o1, o2].flatMap(({ lines }) => lines.map(({ isbn }) => isbn)));
	for (const isbn of isbns) {
		await isbnInput.fill(isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		await table.getByRole("row").filter({ hasText: isbn }).waitFor();
	}

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// Expected state (at the time of this writing):
	//  - order 1:
	//    - line 1: 1 / 2
	//    - line 2: 1 / 1
	//  - order 2:
	//    - line 1: 0 / 3 (same as order 1 line 2 -- the quantity used to fill the former)
	//    - line 2: 1 / 2
	//    - line 3: 1 / 1
	const o1l1 = table.getByRole("row").filter({ hasText: o1.lines[0].isbn });
	// NOTE: This line has the same ISBN as o2l1
	// Using 'hasNot' - as this line will have '1' for ordered and '1' for delivered
	// We can't use 'has' for '1' as the o2l1 will also has '1' for ordered
	const o1l2 = table.getByRole("row").filter({ hasText: o1.lines[1].isbn, hasNot: page.getByRole("cell", { name: "0", exact: true }) });

	const o2l1 = table.getByRole("row").filter({ hasText: o2.lines[0].isbn, has: page.getByRole("cell", { name: "0", exact: true }) });
	const o2l2 = table.getByRole("row").filter({ hasText: o2.lines[1].isbn });
	const o2l3 = table.getByRole("row").filter({ hasText: o2.lines[2].isbn });

	expect(o1l1.getByRole("checkbox")).not.toBeChecked();
	expect(o1l2.getByRole("checkbox")).toBeChecked();
	expect(o2l1.getByRole("checkbox")).not.toBeChecked();
	expect(o2l2.getByRole("checkbox")).not.toBeChecked();
	expect(o2l3.getByRole("checkbox")).toBeChecked();

	// Partial delivery:
	//   - order 1: ordered: 3, delivered: 2
	//   - order 2: ordered: 6, delivered: 2 (the shared ISBN line's quantity is used for order 1)
	//   - total = 4 / 9
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("4 / 9")).toBeVisible();
});

testOrders("compare: multiple orders: partial delivery: 1 line overdelivered", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	const [o1, o2] = supplierOrders;

	// Scan every book once
	const isbns = new Set([o1, o2].flatMap(({ lines }) => lines.map(({ isbn }) => isbn)));
	for (const isbn of isbns) {
		await isbnInput.fill(isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		await table.getByRole("row").filter({ hasText: isbn }).waitFor();
	}

	// Add two more books for order 1, line 1 - 1 to fill, 1 overdelivered
	const l1Row = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
	await l1Row.getByRole("button", { name: "Increase quantity" }).click();
	await l1Row.getByRole("button", { name: "Increase quantity" }).click();

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// Expected state (at the time of this writing):
	//  - order 1:
	//    - line 1: 2 / 2
	//    - line 2: 1 / 1
	//  - order 2:
	//    - line 1: 0 / 3 (same as order 1 line 2 -- the quantity used to fill the former)
	//    - line 2: 1 / 2
	//    - line 3: 1 / 1
	const o1l1 = table.getByRole("row").filter({ hasText: o1.lines[0].isbn });
	// NOTE: This line has the same ISBN as o2l1
	// Using 'hasNot' - as this line will have '1' for ordered and '1' for delivered
	// We can't use 'has' for '1' as the o2l1 will also has '1' for ordered
	const o1l2 = table.getByRole("row").filter({ hasText: o1.lines[1].isbn, hasNot: page.getByRole("cell", { name: "0", exact: true }) });

	const o2l1 = table.getByRole("row").filter({ hasText: o2.lines[0].isbn, has: page.getByRole("cell", { name: "0", exact: true }) });
	const o2l2 = table.getByRole("row").filter({ hasText: o2.lines[1].isbn });
	const o2l3 = table.getByRole("row").filter({ hasText: o2.lines[2].isbn });

	// There should be 1 overdelivered line with this ISBN (no checkbox)
	await o1l1.filter({ hasNot: page.getByRole("checkbox") }).waitFor();

	expect(o1l1.getByRole("checkbox")).toBeChecked();
	expect(o1l2.getByRole("checkbox")).toBeChecked();
	expect(o2l1.getByRole("checkbox")).not.toBeChecked();
	expect(o2l2.getByRole("checkbox")).not.toBeChecked();
	expect(o2l3.getByRole("checkbox")).toBeChecked();

	// Partial delivery:
	//   - order 1: ordered: 3, delivered: 3
	//   - order 2: ordered: 6, delivered: 2 (the shared ISBN line's quantity is used for order 1)
	//   - total = 5 / 9
	// (The overdelivery doesn't affect the total comparision count)
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("5 / 9")).toBeVisible();
});

testOrders("compare: multiple orders: partial delivery: 1 unmatched book", async ({ page, books, supplierOrders }) => {
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: Using the first two orders (from the fixture)
	// NOTE: At the time of this writing, first two orders belonged to the same supplier
	const relevantOrders = table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
	await relevantOrders.nth(0).getByRole("checkbox").click();
	await relevantOrders.nth(1).getByRole("checkbox").click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	const [o1, o2] = supplierOrders;

	// Scan every book once
	const isbns = new Set([o1, o2].flatMap(({ lines }) => lines.map(({ isbn }) => isbn)));
	for (const isbn of isbns) {
		await isbnInput.fill(isbn);
		await page.keyboard.press("Enter");
		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		await table.getByRole("row").filter({ hasText: isbn }).waitFor();
	}

	// Add 1 unmatched book (NOTE: at the time for this writing, books[1] didn't belong to the orders used for this test)
	await isbnInput.fill(books[1].isbn);
	await page.keyboard.press("Enter");
	await table.getByRole("row").filter({ hasText: books[1].isbn }).getByRole("cell", { name: "1", exact: true }).waitFor();

	// Verify compare view
	await page.getByRole("button", { name: "Compare", exact: true }).click();

	// Expected state (at the time of this writing):
	//  - order 1:
	//    - line 1: 1 / 2
	//    - line 2: 1 / 1
	//  - order 2:
	//    - line 1: 0 / 3 (same as order 1 line 2 -- the quantity used to fill the former)
	//    - line 2: 1 / 2
	//    - line 3: 1 / 1
	const o1l1 = table.getByRole("row").filter({ hasText: o1.lines[0].isbn });
	// NOTE: This line has the same ISBN as o2l1
	// Using 'hasNot' - as this line will have '1' for ordered and '1' for delivered
	// We can't use 'has' for '1' as the o2l1 will also has '1' for ordered
	const o1l2 = table.getByRole("row").filter({ hasText: o1.lines[1].isbn, hasNot: page.getByRole("cell", { name: "0", exact: true }) });

	const o2l1 = table.getByRole("row").filter({ hasText: o2.lines[0].isbn, has: page.getByRole("cell", { name: "0", exact: true }) });
	const o2l2 = table.getByRole("row").filter({ hasText: o2.lines[1].isbn });
	const o2l3 = table.getByRole("row").filter({ hasText: o2.lines[2].isbn });

	// There should be 1 unmatched line with this ISBN (no checkbox)
	await table
		.getByRole("row")
		.filter({ hasText: books[1].isbn, hasNot: page.getByRole("checkbox") })
		.waitFor();

	expect(o1l1.getByRole("checkbox")).not.toBeChecked();
	expect(o1l2.getByRole("checkbox")).toBeChecked();
	expect(o2l1.getByRole("checkbox")).not.toBeChecked();
	expect(o2l2.getByRole("checkbox")).not.toBeChecked();
	expect(o2l3.getByRole("checkbox")).toBeChecked();

	// Partial delivery:
	//   - order 1: ordered: 3, delivered: 2
	//   - order 2: ordered: 6, delivered: 2 (the shared ISBN line's quantity is used for order 1)
	//   - total = 5 / 9
	// (The overdelivery doesn't affect the total comparision count)
	await expect(page.getByText("Total delivered:")).toBeVisible();
	await expect(page.getByText("4 / 9")).toBeVisible();
});

testOrders(
	"compare: multiple orders: partial delivery: shared ISBN - filled for order 1, not for order 2",
	async ({ page, supplierOrders }) => {
		await page.goto(appHash("ordered"));

		const table = page.getByRole("table");

		// NOTE: Using the first two orders (from the fixture)
		// NOTE: At the time of this writing, first two orders belonged to the same supplier
		const relevantOrders = table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: supplierOrders[0].order.supplier_name, exact: true }) });
		await relevantOrders.nth(0).getByRole("checkbox").click();
		await relevantOrders.nth(1).getByRole("checkbox").click();

		await page.getByText("Reconcile").first().click();

		const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

		// Use the shared ISBN for the test
		// NOTE: At the time of this writing the following lines shared the same ISBN:
		// - order 1, line 2 - ordered: 1
		// - order 2, line 1 - ordered: 3
		// Total ordered: 4
		//
		// Add 3 books for partial delivery
		await isbnInput.fill(supplierOrders[0].lines[1].isbn);
		await page.keyboard.press("Enter");

		const line = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[1].isbn });

		// Wait for line to appear
		await line.waitFor();
		// Add 2 more
		await line.getByRole("button", { name: "Increase quantity" }).click();
		await line.getByRole("button", { name: "Increase quantity" }).click();

		// Verify compare view
		await page.getByRole("button", { name: "Compare", exact: true }).click();

		// Expected state (at the time of this writing):
		//  - order 1:
		//    - line 2: 1 / 1
		//  - order 2:
		//    - line 1: 2 / 3
		//  NOTE: There are other lines which are irrelevant for this test
		const o1Line = table
			.getByRole("row")
			.filter({ hasText: supplierOrders[0].lines[1].isbn })
			.filter({ has: page.getByRole("cell", { name: "1", exact: true }) });
		const o2Line = table
			.getByRole("row")
			.filter({ hasText: supplierOrders[0].lines[1].isbn })
			.filter({ has: page.getByRole("cell", { name: "2", exact: true }) });

		await expect(o1Line.getByRole("checkbox")).toBeChecked();
		await expect(o2Line.getByRole("checkbox")).not.toBeChecked();

		// Ordered: 9 (accounting for the total of 2 orders)
		// Delivered: 3
		await expect(page.getByText("Total delivered:")).toBeVisible();
		await expect(page.getByText("3 / 9")).toBeVisible();
	}
);

// NOTE: This tests both regular delivery, as well as delivery of unmatched books (and its effects on customer orders)
testOrders("commit: applies delivery updates to customer order lines", async ({ page, customers, supplierOrders }) => {
	// Navigate to supplier orders and start reconciliation
	await page.goto(appHash("ordered"));

	const table = page.getByRole("table");

	// NOTE: using the first order (from the fixture) for the test
	const { order } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("checkbox")
		.click();

	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	// Scan all books belonging to the order
	for (const line of supplierOrders[0].lines) {
		await isbnInput.fill(line.isbn);
		await page.keyboard.press("Enter");

		// Wait for each scanned line to appear so as to not dispatch updates too fast for the UI to handle
		const row = table.getByRole("row").filter({ hasText: line.isbn });
		await row.getByRole("cell", { name: "1", exact: true }).waitFor();

		// Add enough quantity (using the + button)
		// NOTE: upper bound: quantity - 1 -- as we've already added 1 (by scanning)
		for (let i = 0; i < line.quantity - 1; i++) {
			await row.getByRole("button", { name: "Increase quantity" }).click();
		}
	}

	// Scan one unmatched book (it should be processed nonetheless)
	await isbnInput.fill(supplierOrders[2].lines[0].isbn);
	await page.keyboard.press("Enter");
	await table.getByRole("row").filter({ hasText: supplierOrders[2].lines[0].isbn }).getByRole("cell", { name: "1", exact: true }).waitFor();

	// Compare and commit
	await page.getByRole("button", { name: "Compare", exact: true }).click();
	await page.getByRole("button", { name: "Commit", exact: true }).click();
	const dialog = page.getByRole("dialog");
	// The dialog should show a message detailing the delivery of 4 lines -- 3 ordered, 1 unmatched
	await dialog.getByText("4 books will be marked as delivered (and ready to be collected)").waitFor();
	// No lines were rejected -- no rejected message
	await dialog.getByText("books will be marked as rejected (waiting for reordering)").waitFor({ state: "detached" });
	await dialog.getByRole("button", { name: "Confirm" }).click();
	await dialog.waitFor({ state: "detached" });

	//more assertions to give time for the line to be updated to delivered

	// navigate to customer order view
	await page.goto(appHash("customers"));
	await table.getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	await expect(table.getByText(supplierOrders[0].lines[0].isbn)).toBeVisible();
	await expect(table.getByText("Delivered")).toHaveCount(2);
});

testOrders("quantity: should handle quantity adjustments correctly", async ({ page, supplierOrders }) => {
	depends(supplierOrders);
	// Navigate and start reconciliation
	await page.goto(appHash("ordered"));
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	// Add multiple quantities of same book
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);

	// Verify initial quantity
	await expect(firstRow.getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true })).toBeVisible();

	// Increase quantity
	await firstRow.getByRole("button").nth(1).click();
	await expect(firstRow.getByRole("cell", { name: "2", exact: true })).toBeVisible();
});

testOrders("quantity:should remove line when quantity reaches zero", async ({ page, supplierOrders }) => {
	depends(supplierOrders);
	await page.goto(appHash("ordered"));
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

	// Add single quantity
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);

	// Verify initial quantity
	await expect(firstRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();

	// Decrease quantity to zero
	await page.getByLabel("Decrease quantity").click();

	// Verify line is removed
	await expect(firstRow.getByRole("cell", { name: supplierOrders[0].lines[0].isbn, exact: true })).not.toBeVisible();
});

testOrders("quantity: should handle multiple quantity adjustments", async ({ page, supplierOrders, books }) => {
	depends(supplierOrders);
	await page.goto(appHash("ordered"));
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");

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

testOrders("delete: should allow supplier orders to be reconciled again after deletion", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));
	await page.getByText("Ordered").nth(1).click();

	// Select multiple orders
	const items = await page.getByRole("checkbox").all();
	const beforeLast = items[items.length - 2];
	await beforeLast.click();
	await page.getByRole("checkbox").last().click();
	await page.getByText("Reconcile").first().click();

	// Add scanned books
	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	// Delete and verify all supplier orders can be reconciled again
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	await page.waitForURL("**/orders/suppliers/orders/");
	await page.waitForTimeout(1000);
	await page.reload();

	// Verify back at supplier orders
	// stalling here to give time for the page to load the deleted orders
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();

	// Should be able to start new reconciliation with same orders
	await page.getByText("Ordered").nth(1).click();
	await expect(page.getByRole("checkbox").nth(1)).toBeVisible();

	await page.getByRole("checkbox").nth(1).click();
	await page.getByRole("checkbox").nth(2).click();
	await page.getByText("Reconcile").first().click();
});

testOrders("delete: should not delete reconciliation order when canceling deletion", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Add some scanned books
	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");

	// Try to delete but cancel
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Cancel" }).click();

	// Verify we're still on reconciliation page
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
	// Verify scanned books still present
	await expect(page.getByText(supplierOrders[0].lines[0].isbn)).toBeVisible();
});

testOrders("delete: should allow deletion after comparing books", async ({ page, supplierOrders }) => {
	await page.goto(appHash("ordered"));
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Add books and go to compare view
	const isbnInput = page.getByPlaceholder("Enter ISBN of ordered books");
	await isbnInput.fill(supplierOrders[0].lines[0].isbn);
	await page.keyboard.press("Enter");
	await page.getByRole("button", { name: "Compare" }).nth(1).click();

	// Delete from compare view
	await page.getByRole("button", { name: "Delete reconciliation order" }).click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByRole("dialog")).toBeHidden();

	// Verify back at supplier orders
	await expect(page.getByText("Ordered", { exact: true })).toBeVisible();
});

testOrders("finalize: should disable all action buttons when an order is finalized", async ({ page, supplierOrders }) => {
	depends(supplierOrders);
	await page.goto(appHash("ordered"));
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();

	// Simulate finalizing the order
	const dialog = page.getByRole("dialog");
	await page.getByRole("button", { name: "Compare" }).first().click();
	await page.getByRole("button", { name: "Commit" }).nth(1).click();

	await dialog.getByRole("button", { name: "Confirm" }).click();
	await expect(dialog).not.toBeVisible();

	//navigate to completed orders
	await page.goto(appHash("completed"));

	await page.getByRole("button", { name: "View Reconciliation", exact: true }).first().click();

	// Verify all action buttons are disabled
	const populate = await page.getByRole("button", { name: "populate" }).all();
	for (const button of populate) {
		await expect(button).toBeDisabled();
	}
	const commit = await page.getByRole("button", { name: "commit" }).all();
	for (const button of commit) {
		await expect(button).toBeDisabled();
	}
	const deleteButton = page.getByLabel("Delete reconciliation order");
	await expect(deleteButton).toBeDisabled();
});

// NOTE: This test tests the ability of committing an empty reconciliation order, but also doubles as a test for first-come-first-serve order rejection
testOrders(
	"commit: allows committing of an empty reconciliation order (rejecting all lines associated with respective supplier orders)",
	async ({ page, books, customers, supplierOrders }) => {
		// Navigate to supplier orders and start reconciliation
		await page.goto(appHash("ordered"));

		const table = page.getByRole("table");

		// await page.getByRole("button", { name: "Ordered", exact: true }).click();

		// NOTE: using the first order (from the fixture) for the test
		const { order } = supplierOrders[0];
		await table
			.getByRole("row")
			.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
			.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
			.getByRole("checkbox")
			.click();

		await page.getByText("Reconcile").first().click();

		// NOTE: not scanning anything -- straight to commit

		// Compare and commit
		await page.getByRole("button", { name: "Compare", exact: true }).click();
		await page.getByRole("button", { name: "Commit", exact: true }).click();
		const dialog = page.getByRole("dialog");
		// No books were delivered -- no delivery message should be shown
		await dialog.getByText("books will be marked as delivered (and ready to be collected)").waitFor({ state: "detached" });
		// The dialog should show a message detailing the rejection of 3 lines
		await dialog.getByText("3 books will be marked as rejected (waiting for reordering)").waitFor();
		await dialog.getByRole("button", { name: "Confirm" }).click();
		await dialog.waitFor({ state: "detached" });

		// Navigate to customers page and check customers
		//
		// NOTE: At the time of this writing, this is the state
		// Supplier order 1 (the one we just reconciled):
		//  isbn: "1234", quantity: 2 - 2 lines rejected
		//  isbn: "5678", quantity: 1 = 1 line rejected
		//
		// Supplier order 2 :
		//  isbn: "5678", quantity: 3
		//  isbn: "9999", quantity: 2
		//  isbn: "7777", quantity: 1
		//
		// Supplier order 3 :
		//  isbn: "4321", quantity: 1
		//  isbn: "8765", quantity: 1
		//  isbn: "8888", quantity: 1
		//
		// Relvant customer order lines (in order of creation -- placed by the customer)
		//
		// NOTE: orders are rejected in reverse order of creation (regardless of respective supplier order)
		// respecting first-come-first-server principle
		//
		// - customer 1 - ISBN: 1234 (rejected)
		// - customer 1 - ISBN: 5678 (not-rejected -- only one was part of supplier order 1)
		// - customer 2 - ISBN: 5678 (rejected)
		// - customer 3 - ISBN: 1234 (rejected)
		//
		// NOTE: The following lines are part of the supplier order and are matched by ISBN and
		// used to inspect different customer orders affected by the reconciliation
		const l1 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[0].isbn });
		const l2 = table.getByRole("row").filter({ hasText: supplierOrders[0].lines[1].isbn });
		// NOTE: The not-affected line is a catch-all for all lines with ISBNs not affected by the order
		const irrelevantISBNS = books.map(({ isbn }) => isbn).filter((isbn) => !supplierOrders[0].lines.find((l) => l.isbn === isbn));
		const irrelevantISBNSRegex = new RegExp(`(${irrelevantISBNS.join("|")})`);
		const lNotAffected = table.getByRole("row").filter({ hasText: irrelevantISBNSRegex });

		// Check customer 1
		//
		// NOTE: at the time for this writing, the customer order 1 had the following lines
		// - ISBN: 1234, quantity: 1 (rejected -- set back to pending)
		// - ISBN: 5678, quantity: 1 (not rejected -- still placed)
		// - ISBN: 8888, quantity: 1 (not affected by this order -- still placed)
		//
		// NOTE: In CI the navigation is somewhat broken: you can't navigate to a specific page with dynamic params,
		// so we have to go to a static page (no dynamic params) and navigate from there
		// TODO: Replace the lines below with the commented line(s) when the hash routing is implemented
		//
		// await page.goto(`${baseURL}orders/customers/${customers[0].id}/`);
		await page.goto(appHash("customers"));
		await page.getByText(customers[0].fullname).waitFor();
		await table.getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

		await l1.getByRole("cell", { name: "Pending" }).waitFor();
		await l2.getByRole("cell", { name: "Placed" }).waitFor();
		await expect(lNotAffected).toHaveCount(1);
		await lNotAffected.nth(0).getByRole("cell", { name: "Placed" }).waitFor();

		// Check customer 2
		//
		// NOTE: at the time for this writing, the customer order 2 had the following lines
		// - ISBN: 5678, quantity: 1 (corresponds to order 1 - line 2 -- rejected - set back to pending)
		// - ISBN: 4321, quantity: 1 (not affected by this order -- still placed)
		// - ISBN: 7777, quantity: 1 (not affected by this order -- still placed)
		// - ISBN: 8765, quantity: 1 (not affected by this order -- still placed)
		//
		// NOTE: In CI the navigation is somewhat broken: you can't navigate to a specific page with dynamic params,
		// so we have to go to a static page (no dynamic params) and navigate from there
		// TODO: Replace the lines below with the commented line(s) when the hash routing is implemented
		//
		// await page.goto(`${baseURL}orders/customers/${customers[1].id}/`);
		await page.goto(appHash("customers"));
		await page.getByText(customers[1].fullname).waitFor();
		await table.getByRole("row").filter({ hasText: customers[1].fullname }).getByRole("link", { name: "Edit" }).click();

		await l2.getByRole("cell", { name: "Pending" }).waitFor(); // Rejected
		await expect(lNotAffected).toHaveCount(3);
		await lNotAffected.nth(0).getByRole("cell", { name: "Placed" }).waitFor();
		await lNotAffected.nth(1).getByRole("cell", { name: "Placed" }).waitFor();
		await lNotAffected.nth(2).getByRole("cell", { name: "Placed" }).waitFor();

		// Check customer 3
		//
		// NOTE: at the time for this writing, the customer order 3 had the following lines
		// - ISBN: 1234, quantity: 1 (rejected, set back to placed -- supplier order 1 - line 1)
		// - ISBN: 9999, quantity: 1 (not affected by this order -- still placed)
		//
		// NOTE: In CI the navigation is somewhat broken: you can't navigate to a specific page with dynamic params,
		// so we have to go to a static page (no dynamic params) and navigate from there
		// TODO: Replace the lines below with the commented line(s) when the hash routing is implemented
		//
		// await page.goto(`${baseURL}orders/customers/${customers[2].id}/`);
		await page.goto(appHash("customers"));
		await page.getByText(customers[2].fullname).waitFor();
		await table.getByRole("row").filter({ hasText: customers[2].fullname }).getByRole("link", { name: "Edit" }).click();

		await l1.getByRole("cell", { name: "Pending" }).waitFor();
		await expect(lNotAffected).toHaveCount(1);
		await lNotAffected.nth(0).getByRole("cell", { name: "Placed" }).waitFor();
	}
);
