import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDbHandle } from "@/helpers";
import {
	addBooksToCustomer,
	associatePublisher,
	createReconciliationOrder,
	createSupplierOrder,
	deleteReconciliationOrder,
	finalizeReconciliationOrder,
	upsertBook
} from "@/helpers/cr-sqlite";
import { depends, testOrders } from "@/helpers/fixtures";

testOrders("order tabs (filters): shows completed orders under 'completed' tab", async ({ page, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const dbHandle = await getDbHandle(page);

	// The tab should be disabled - no completed orders
	await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeDisabled();

	// Complete two orders - create a reconciliation order and finalize it
	const [o1, o2] = supplierOrders;
	await dbHandle.evaluate(createReconciliationOrder, { id: 1, supplierOrderIds: [o1.order.id, o2.order.id] });
	await dbHandle.evaluate(finalizeReconciliationOrder, 1);

	// Check the 'Completed' view
	await page.getByRole("button", { name: "Completed", exact: true }).click();

	await page.getByRole("table").getByRole("row").nth(2).waitFor();
});

testOrders("should show empty state when no customer orders exist", async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	await expect(page.getByRole("table")).not.toBeVisible();
	await expect(page.getByText("No unordered supplier orders available")).toBeVisible();

	const createOrderButton = page.getByRole("button", { name: "New Customer Order" });
	await expect(createOrderButton).toBeVisible();

	await createOrderButton.click();

	await expect(page.getByRole("dialog")).toBeVisible();
});

testOrders("should show list of unordered orders", async ({ page, suppliers: [supplier], books }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });
	await dbHandle.evaluate(associatePublisher, { supplierId: supplier.id, publisher: "pub1" });

	await page.goto(`${baseURL}orders/suppliers/orders/`);
	page.getByRole("button", { name: "Unordered" });

	await expect(page.getByText(supplier.name)).toBeVisible();
	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(2);
	await expect(firstRow.getByRole("cell", { name: supplier.name })).toBeVisible();
	// assert for quantity cell with a value of "1"
	await expect(firstRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});

// NOTE: the functionality tested here is changed somewhat and portion of it is tested below, but this is left (skipped)
// as a TODO / reminder for (future) full e2e test refactor
testOrders.skip(
	"should allow a new supplier order to be placed from a batch of possible customer order lines",
	async ({ page, suppliers: [supplier], books, customers }) => {
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(associatePublisher, { supplierId: supplier.id, publisher: "pub1" });

		// Add 2 copies of first book to customer's order
		await dbHandle.evaluate(addBooksToCustomer, {
			customerId: customers[0].id,
			bookIsbns: [books[0].isbn, books[0].isbn]
		});
		// Add 2 copies of third book to customer's order
		await dbHandle.evaluate(addBooksToCustomer, {
			customerId: customers[0].id,
			bookIsbns: [books[2].isbn, books[2].isbn]
		});

		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const table = page.getByRole("table");

		await page.getByRole("button", { name: "Unordered" }).waitFor();

		// Go to new-order view
		await table.getByRole("row").filter({ hasText: supplier.name }).getByRole("button", { name: "Place Order" }).click();

		// Verify rows
		const allIsbns = books.map((book) => book.isbn);
		const isbnRegex = new RegExp(`(${allIsbns.join("|")})`);
		// NOTE: we're matching all ISBNs used in fixtures to make sure no additional rows creep into the view
		const bookRows = table.getByRole("row").filter({ hasText: isbnRegex });

		await expect(bookRows).toHaveCount(2);

		// Check first row - books[0] ISBN comes first alphabetically
		//
		// Verify the row first
		await bookRows.nth(0).getByText(books[0].isbn).waitFor();
		// Verify cell order: (no name - select checkbox) | ISBN | Title | Authors | Quantity | Total Price
		await bookRows.nth(0).getByRole("cell").nth(0).getByRole("checkbox").waitFor();
		await bookRows.nth(0).getByRole("cell").nth(1).getByText(books[0].isbn, { exact: true }).waitFor();
		await bookRows.nth(0).getByRole("cell").nth(2).getByText(books[0].title, { exact: true }).waitFor();
		await bookRows.nth(0).getByRole("cell").nth(3).getByText(books[0].authors, { exact: true }).waitFor();
		await bookRows.nth(0).getByRole("cell").nth(4).getByText("2", { exact: true }).waitFor();
		const l1TotalPrice = (2 * books[0].price).toString();
		await bookRows.nth(0).getByRole("cell").nth(5).getByText(`€${l1TotalPrice}`, { exact: true }).waitFor();

		// Check second row
		//
		// Verify the row first
		await bookRows.nth(1).getByText(books[2].isbn).waitFor();
		// Verify cell order: (no name - select checkbox) | ISBN | Title | Authors | Quantity | Total Price
		await bookRows.nth(1).getByRole("cell").nth(0).getByRole("checkbox").waitFor();
		await bookRows.nth(1).getByRole("cell").nth(1).getByText(books[2].isbn, { exact: true }).waitFor();
		await bookRows.nth(1).getByRole("cell").nth(2).getByText(books[2].title, { exact: true }).waitFor();
		await bookRows.nth(1).getByRole("cell").nth(3).getByText(books[2].authors, { exact: true }).waitFor();
		await bookRows.nth(1).getByRole("cell").nth(4).getByText("2", { exact: true }).waitFor();
		const l2TotalPrice = (2 * books[2].price).toString();
		await bookRows.nth(1).getByRole("cell").nth(5).getByText(`€${l2TotalPrice}`, { exact: true }).waitFor();

		// total book count (4 books total: 2 of first book + 2 of third book)
		await expect(page.getByText("4", { exact: true })).toBeVisible();
		// total price
		await expect(page.getByText("80")).toBeVisible();

		await page.getByRole("checkbox").nth(1).click();

		// total book count
		await expect(page.getByText("2", { exact: true }).nth(1)).toBeVisible();
		// total price
		await expect(page.getByText("20")).toHaveCount(2);

		await page.getByRole("checkbox").nth(2).click();

		//total book count
		await expect(page.getByText("4", { exact: true })).toBeVisible();
		//total price
		await expect(page.getByText("80")).toHaveCount(2);

		// Click "Select 1/2" button to reduce quantity
		await page.getByRole("button", { name: "Select 1/2" }).click();

		// Verify updated totals (1 book selected)
		await expect(page.getByText("1", { exact: true })).toBeVisible();
		//total price
		await expect(page.getByText("20")).toHaveCount(2);

		await page.getByRole("button", { name: "Place Order" }).first().click();

		await page.waitForURL(`${baseURL}orders/suppliers/orders/`);
		page.getByRole("button", { name: "Ordered" }).nth(1).click();

		await expect(page.getByText(supplier.name)).toBeVisible();
		await expect(page.getByText("reconcile")).toBeVisible();

		await page.goto(`${baseURL}orders/suppliers/orders/`);
		page.getByRole("button", { name: "Unordered" });
		// Start new order
		await page.getByRole("button", { name: "Place Order" }).first().click();

		// Verify remaining unordered books can be ordered separately (third book ISBN)
		await expect(page.getByText(books[2].isbn)).toBeVisible();
		// Verify remaining totals (2 books at 30 each = 60)
		await expect(page.getByText("2", { exact: true })).toHaveCount(2);
		//total price
		await expect(page.getByText("60")).toHaveCount(2);
	}
);

testOrders("should view reconciliation controls for orders already in reconciliation", async ({ page, suppliers: [supplier], books }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const dbHandle = await getDbHandle(page);

	// Create a supplier order that will be part of reconciliation
	await dbHandle.evaluate(createSupplierOrder, {
		id: 1,
		supplierId: supplier.id,
		orderLines: [
			{
				supplier_id: supplier.id,
				isbn: books[0].isbn,
				quantity: 1,
				supplier_name: supplier.name
			}
		]
	});

	// Create another order that won't be in reconciliation (for comparison)
	await dbHandle.evaluate(createSupplierOrder, {
		id: 2,
		supplierId: supplier.id,
		orderLines: [
			{
				supplier_id: supplier.id,
				isbn: books[1].isbn,
				quantity: 1,
				supplier_name: supplier.name
			}
		]
	});

	// Add first order to reconciliation
	await dbHandle.evaluate(createReconciliationOrder, {
		id: 1,
		supplierOrderIds: [1]
	});

	// Navigate to supplier's orders view
	await page.goto(`${baseURL}orders/suppliers/${supplier.id}/`);

	// Get the table rows for both orders
	const table = page.getByRole("table").nth(3);
	const rows = table.getByRole("row");

	// First order (in reconciliation) should have disabled controls
	const reconciledRow = rows.nth(2);

	await expect(reconciledRow.getByRole("button", { name: "View Reconciliation" })).toBeVisible();
	await expect(reconciledRow.getByRole("checkbox")).toBeDisabled();

	// Second order (not in reconciliation) should have enabled controls
	const normalRow = rows.nth(1);
	await expect(normalRow.getByRole("checkbox")).toBeEnabled();
	await expect(normalRow.getByRole("button", { name: "Reconcile" })).toBeEnabled();
});

testOrders(
	"should show correct batch reconciliation state with mixed reconciliation status",
	async ({ page, suppliers: [supplier], books }) => {
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const dbHandle = await getDbHandle(page);

		// Create three orders: two normal, one already in reconciliation
		await dbHandle.evaluate(createSupplierOrder, {
			id: 1,
			supplierId: supplier.id,
			orderLines: [
				{
					supplier_id: supplier.id,
					isbn: books[0].isbn,
					quantity: 1,
					supplier_name: supplier.name
				}
			]
		});

		await dbHandle.evaluate(createSupplierOrder, {
			id: 2,
			supplierId: supplier.id,
			orderLines: [
				{
					supplier_id: supplier.id,
					isbn: books[1].isbn,
					quantity: 1,
					supplier_name: supplier.name
				}
			]
		});

		await dbHandle.evaluate(createSupplierOrder, {
			id: 3,
			supplierId: supplier.id,
			orderLines: [
				{
					supplier_id: supplier.id,
					isbn: books[2].isbn,
					quantity: 1,
					supplier_name: supplier.name
				}
			]
		});

		// Add one order to reconciliation
		await dbHandle.evaluate(createReconciliationOrder, {
			id: 1,
			supplierOrderIds: [1]
		});

		await page.goto(`${baseURL}orders/suppliers/${supplier.id}/`);

		// Select the two non-reconciled orders
		const table = page.getByRole("table").nth(3);
		const rows = table.getByRole("row");

		// First order checkbox should be disabled (already in reconciliation)
		await expect(rows.nth(3).getByRole("checkbox")).toBeDisabled();

		// Select the other two orders
		await rows.nth(1).getByRole("checkbox").click();
		//one more row is added (reconcile selected)
		await rows.nth(3).getByRole("checkbox").click();

		// Verify batch reconciliation button appears and is enabled
		const batchReconcileButton = page.getByLabel("Reconcile 2 selected orders");
		await expect(batchReconcileButton).toBeVisible();
		await expect(batchReconcileButton).toBeEnabled();

		// Verify the selection summary shows correct count (2, not 3)
		await expect(page.getByText("2 orders selected")).toBeVisible();
	}
);

testOrders("new order: empty state", async ({ page, books, suppliersWithPublishers, customerOrderLines }) => {
	const suppliers = suppliersWithPublishers;

	const table = page.getByRole("table");

	await page.goto(`${baseURL}orders/suppliers/orders/`);

	// NOTE: this should be unnecessary once the reactivity fix is in
	await page.reload();
	await page.waitForTimeout(500);

	// Use supplier 1 for the test
	await table.getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("button", { name: "Place Order" }).click();

	// The state should show all possible order lines, with ordered quantity/total price and selected quantity/total price (currently 0)
	const isbnRegex = new RegExp(`(${books.map(({ isbn }) => isbn).join("|")})`);
	const possibleOrderRow = table.getByRole("row").filter({ hasText: isbnRegex });

	// NOTE: at the time of this writing, this is the state
	//
	// books[0] - isbn: "1234", title: "title1", authors: "author1", price: 10, quantity: 2
	// books[2] - isbn: "5678", title: "title3", authors: "author3", price: 30, quantity: 2
	// books[6] - isbn: "7777", title: "title7", authors: "author7", price: 70, quantity: 1
	// books[4] - isbn: "9999", title: "title5", authors: "author5", price: 50, quantity: 1
	await expect(possibleOrderRow).toHaveCount(4);

	// books[0] - isbn: "1234", title: "title1", authors: "author1", price: 10, quantity: 2
	//
	// NOTE: cells are offset by 1 - checkbox
	await expect(possibleOrderRow.nth(0).getByRole("checkbox")).not.toBeChecked();
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(1)).toHaveText(books[0].isbn);
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(2)).toHaveText(books[0].title);
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(3)).toHaveText(books[0].authors);
	// Possible (ordered) quantity
	const book1OrderedQuantity = customerOrderLines.byIsbn[books[0].isbn];
	const book1OrderedPrice = book1OrderedQuantity * books[0].price;
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(4)).toHaveText(book1OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(5)).toHaveText(`€${book1OrderedPrice}`);
	// Selected quantity
	const book1SelectedQuantity = 0;
	const book1SelectedPrice = book1SelectedQuantity * books[0].price;
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(6)).toHaveText(book1SelectedQuantity.toString());
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(7)).toHaveText(`€${book1SelectedPrice}`);

	// books[2] - isbn: "5678", title: "title3", authors: "author3", price: 30, quantity: 2
	//
	// NOTE: cells are offset by 1 - checkbox
	await expect(possibleOrderRow.nth(1).getByRole("checkbox")).not.toBeChecked();
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(1)).toHaveText(books[2].isbn);
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(2)).toHaveText(books[2].title);
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(3)).toHaveText(books[2].authors);
	// Possible (ordered) quantity
	const book2OrderedQuantity = customerOrderLines.byIsbn[books[2].isbn];
	const book2OrderedPrice = book2OrderedQuantity * books[2].price;
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(4)).toHaveText(book2OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(5)).toHaveText(`€${book2OrderedPrice}`);
	// Selected quantity
	const book2SelectedQuantity = 0;
	const book2SelectedPrice = book2SelectedQuantity * books[2].price;
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(6)).toHaveText(book2SelectedQuantity.toString());
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(7)).toHaveText(`€${book2SelectedPrice}`);

	// books[6] - isbn: "7777", title: "title7", authors: "author7", price: 70, quantity: 1
	//
	// NOTE: cells are offset by 1 - checkbox
	await expect(possibleOrderRow.nth(2).getByRole("checkbox")).not.toBeChecked();
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(1)).toHaveText(books[6].isbn);
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(2)).toHaveText(books[6].title);
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(3)).toHaveText(books[6].authors);
	// Possible (ordered) quantity
	const book3OrderedQuantity = customerOrderLines.byIsbn[books[6].isbn];
	const book3OrderedPrice = book3OrderedQuantity * books[6].price;
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(4)).toHaveText(book3OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(5)).toHaveText(`€${book3OrderedPrice}`);
	// Selected quantity
	const book3SelectedQuantity = 0;
	const book3SelectedPrice = book3SelectedQuantity * books[6].price;
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(6)).toHaveText(book3SelectedQuantity.toString());
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(7)).toHaveText(`€${book3SelectedPrice}`);

	// books[4] - isbn: "9999", title: "title5", authors: "author5", price: 50, quantity: 1
	//
	// NOTE: cells are offset by 1 - checkbox
	await expect(possibleOrderRow.nth(3).getByRole("checkbox")).not.toBeChecked();
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(1)).toHaveText(books[4].isbn);
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(2)).toHaveText(books[4].title);
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(3)).toHaveText(books[4].authors);
	// Possible (ordered) quantity
	const book4OrderedQuantity = customerOrderLines.byIsbn[books[4].isbn];
	const book4OrderedPrice = book4OrderedQuantity * books[4].price;
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(4)).toHaveText(book4OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(5)).toHaveText(`€${book4OrderedPrice}`);
	// Selected quantity
	const book4SelectedQuantity = 0;
	const book4SelectedPrice = book4SelectedQuantity * books[4].price;
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(6)).toHaveText(book4SelectedQuantity.toString());
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(7)).toHaveText(`€${book4SelectedPrice}`);
});

testOrders(
	"new order: selects fractions based on price + uses row checkbox to toggle between full and empty state for the line",
	async ({ page, books, suppliersWithPublishers, customerOrderLines }) => {
		depends(customerOrderLines);

		const suppliers = suppliersWithPublishers;

		const table = page.getByRole("table");

		await page.goto(`${baseURL}orders/suppliers/orders/`);

		// NOTE: this should be unnecessary once the reactivity fix is in
		await page.reload();
		await page.waitForTimeout(500);

		// Use supplier 1 for the test
		await table.getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("button", { name: "Place Order" }).click();

		// The state should show all possible order lines, with ordered quantity/total price and selected quantity/total price (currently 0)
		const isbnRegex = new RegExp(`(${books.map(({ isbn }) => isbn).join("|")})`);
		const possibleOrderRow = table.getByRole("row").filter({ hasText: isbnRegex });

		// NOTE: at the time of this writing, this is the state
		//
		// books[0] - isbn: "1234", title: "title1", authors: "author1", price: 10, quantity: 2
		// books[2] - isbn: "5678", title: "title3", authors: "author3", price: 30, quantity: 2
		// books[6] - isbn: "7777", title: "title7", authors: "author7", price: 70, quantity: 1
		// books[4] - isbn: "9999", title: "title5", authors: "author5", price: 50, quantity: 1
		//
		// Total possible price = (2 * 10) + (2 * 30) + (1 * 70) + (1 * 50) = 200
		await expect(possibleOrderRow).toHaveCount(4);

		// Select 1/4 = total price (200) / 4 = 50
		await page.getByText("Select 1/4").click();

		// books[0] - isbn: "1234", ordered: 2, selected: 2 -- running total price: 20
		let book1SelectedQuantity = 2;
		let book1SelectedPrice = book1SelectedQuantity * books[0].price;
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(6)).toHaveText(book1SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(7)).toHaveText(`€${book1SelectedPrice}`);
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[2] - isbn: "5678", ordered: 2 selected: 1 -- running total price: 50 (END HERE)
		let book2SelectedQuantity = 1;
		let book2SelectedPrice = book2SelectedQuantity * books[2].price;
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(6)).toHaveText(book2SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(7)).toHaveText(`€${book2SelectedPrice}`);
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).not.toBeChecked(); // Partial selection

		// books[6] - isbn: "7777", ordered: 1, selected: 0
		let book3SelectedQuantity = 0;
		let book3SelectedPrice = book3SelectedQuantity * books[6].price;
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(6)).toHaveText(book3SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(7)).toHaveText(`€${book3SelectedPrice}`);
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).not.toBeChecked(); // Empty selection

		// books[4] - isbn: "9999", ordered: 1, selected 0
		let book4SelectedQuantity = 0;
		let book4SelectedPrice = book4SelectedQuantity * books[4].price;
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(6)).toHaveText(book4SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(7)).toHaveText(`€${book4SelectedPrice}`);
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).not.toBeChecked(); // Empty selection

		// Select 1/2 = total price (200) / 2 = 100
		await page.getByText("Select 1/2").click();

		// books[0] - isbn: "1234", ordered: 2, selected: 2 -- running total price: 20
		book1SelectedQuantity = 2;
		book1SelectedPrice = book1SelectedQuantity * books[0].price;
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(6)).toHaveText(book1SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(7)).toHaveText(`€${book1SelectedPrice}`);
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[2] - isbn: "5678", ordered: 2 selected: 2 -- running total price: 80
		book2SelectedQuantity = 2;
		book2SelectedPrice = book2SelectedQuantity * books[2].price;
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(6)).toHaveText(book2SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(7)).toHaveText(`€${book2SelectedPrice}`);
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[6] - isbn: "7777", ordered: 1, selected: 0 -- adding next one would make the total price 150 (>100) -- STOP HERE
		book3SelectedQuantity = 0;
		book3SelectedPrice = book3SelectedQuantity * books[6].price;
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(6)).toHaveText(book3SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(7)).toHaveText(`€${book3SelectedPrice}`);
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).not.toBeChecked(); // Empty selection

		// books[4] - isbn: "9999", ordered: 1, selected 0
		book4SelectedQuantity = 0;
		book4SelectedPrice = book4SelectedQuantity * books[4].price;
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(6)).toHaveText(book4SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(7)).toHaveText(`€${book4SelectedPrice}`);
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).not.toBeChecked(); // Empty selection

		// Select 3/4 = total price (200) * 3 / 4 = 150
		await page.getByText("Select 3/4").click();

		// books[0] - isbn: "1234", ordered: 2, selected: 2 -- running total price: 20
		book1SelectedQuantity = 2;
		book1SelectedPrice = book1SelectedQuantity * books[0].price;
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(6)).toHaveText(book1SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(7)).toHaveText(`€${book1SelectedPrice}`);
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[2] - isbn: "5678", ordered: 2 selected: 2 -- running total price: 80
		book2SelectedQuantity = 2;
		book2SelectedPrice = book2SelectedQuantity * books[2].price;
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(6)).toHaveText(book2SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(7)).toHaveText(`€${book2SelectedPrice}`);
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[6] - isbn: "7777", ordered: 1, selected: 1 -- running total price: 150 (END HERE)
		book3SelectedQuantity = 1;
		book3SelectedPrice = book3SelectedQuantity * books[6].price;
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(6)).toHaveText(book3SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(7)).toHaveText(`€${book3SelectedPrice}`);
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[4] - isbn: "9999", ordered: 1, selected 0
		book4SelectedQuantity = 0;
		book4SelectedPrice = book4SelectedQuantity * books[4].price;
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(6)).toHaveText(book4SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(7)).toHaveText(`€${book4SelectedPrice}`);
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).not.toBeChecked(); // Empty selection

		// Select All
		await page.getByText("Select All").click();

		// books[0] - isbn: "1234", ordered: 2, selected: 2
		book1SelectedQuantity = 2;
		book1SelectedPrice = book1SelectedQuantity * books[0].price;
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(6)).toHaveText(book1SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(0).getByRole("cell").nth(7)).toHaveText(`€${book1SelectedPrice}`);
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[2] - isbn: "5678", ordered: 2 selected: 2
		book2SelectedQuantity = 2;
		book2SelectedPrice = book2SelectedQuantity * books[2].price;
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(6)).toHaveText(book2SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(7)).toHaveText(`€${book2SelectedPrice}`);
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[6] - isbn: "7777", ordered: 1, selected: 1
		book3SelectedQuantity = 1;
		book3SelectedPrice = book3SelectedQuantity * books[6].price;
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(6)).toHaveText(book3SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(2).getByRole("cell").nth(7)).toHaveText(`€${book3SelectedPrice}`);
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).toBeChecked(); // Full selection

		// books[4] - isbn: "9999", ordered: 1, selected 1
		book4SelectedQuantity = 1;
		book4SelectedPrice = book4SelectedQuantity * books[4].price;
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(6)).toHaveText(book4SelectedQuantity.toString());
		await expect(possibleOrderRow.nth(3).getByRole("cell").nth(7)).toHaveText(`€${book4SelectedPrice}`);
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).toBeChecked(); // Full selection

		// Go back to 1/4 selection -- test checkbox functionality
		//
		// Yielding the following state:
		//
		// books[0] - isbn: "1234", ordered quantity: 2, selected: 2
		// books[2] - isbn: "5678", ordered quantity: 2, selected: 1
		// books[6] - isbn: "7777", ordered quantity: 1, selected: 0
		// books[4] - isbn: "9999", ordered quantity: 1, selected: 0
		await page.getByText("Select 1/4").click();

		// Line 2, ISBN: "5678", ordered: 2, selected: 1 -- checkbox should not be checked
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).not.toBeChecked();

		// Toggle checkbox -- should select full ordered quantity
		await possibleOrderRow.nth(1).getByRole("checkbox").click();
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(6)).toHaveText("2");

		// Toggle checkbox -- should select 0
		await possibleOrderRow.nth(1).getByRole("checkbox").click();
		await expect(possibleOrderRow.nth(1).getByRole("cell").nth(6)).toHaveText("0");
	}
);

testOrders("supplier order page: view + reactivity", async ({ page, books, supplierOrders }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const table = page.getByRole("table");

	await page.getByRole("button", { name: "Ordered", exact: true }).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order, lines } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.totalBooks.toString(), exact: true }) })
		.getByRole("button", { name: "View Order" })
		.click();

	// Wait for navigation
	await page.waitForURL(`${baseURL}orders/suppliers/orders/${order.id}/`);

	// Displays supplier name
	await page.getByText(order.supplier_name).waitFor();

	// Check for order lines
	const isbnMatch = new RegExp(`(${books.map(({ isbn }) => isbn).join("|")})`);
	const orderLineRow = page.getByRole("table").getByRole("row").filter({ hasText: isbnMatch });

	// The state at the time of this writing
	//
	// isbn: "1234", quantity: 2
	// isbn: "5678", quantity: 1
	await expect(orderLineRow).toHaveCount(2);

	const line1 = { ...lines[0], ...books.find(({ isbn }) => lines[0].isbn === isbn) };
	await orderLineRow.nth(0).getByRole("cell").nth(0).getByText(line1.isbn).waitFor();
	await orderLineRow.nth(0).getByRole("cell").nth(1).getByText(line1.title).waitFor();
	await orderLineRow.nth(0).getByRole("cell").nth(2).getByText(line1.authors).waitFor();
	await orderLineRow.nth(0).getByRole("cell").nth(3).getByText(line1.quantity.toString()).waitFor();
	const l1Price = `€${line1.quantity * line1.price}`;
	await orderLineRow.nth(0).getByRole("cell").nth(4).getByText(l1Price).waitFor();

	const line2 = { ...lines[1], ...books.find(({ isbn }) => lines[1].isbn === isbn) };
	await orderLineRow.nth(1).getByRole("cell").nth(0).getByText(line2.isbn).waitFor();
	await orderLineRow.nth(1).getByRole("cell").nth(1).getByText(line2.title).waitFor();
	await orderLineRow.nth(1).getByRole("cell").nth(2).getByText(line2.authors).waitFor();
	await orderLineRow.nth(1).getByRole("cell").nth(3).getByText(line2.quantity.toString()).waitFor();
	const l2Price = `€${line2.quantity * line2.price}`;
	await orderLineRow.nth(1).getByRole("cell").nth(4).getByText(l2Price).waitFor();

	// Test for reactivity to changes in book data
	// NOTE: At the time of this writing, the first book corresponds to the first order line of the first order
	const updatedBook1 = { isbn: books[0].isbn, title: "Updated Title", authors: "Updated Author", price: 50 };
	await (await getDbHandle(page)).evaluate(upsertBook, updatedBook1);

	await orderLineRow.nth(0).getByRole("cell").nth(0).getByText(updatedBook1.isbn).waitFor();
	await orderLineRow.nth(0).getByRole("cell").nth(1).getByText(updatedBook1.title).waitFor();
	await orderLineRow.nth(0).getByRole("cell").nth(2).getByText(updatedBook1.authors).waitFor();
	await orderLineRow.nth(0).getByRole("cell").nth(3).getByText(line1.quantity.toString()).waitFor();
	const l1PriceUpdated = `€${line1.quantity * updatedBook1.price}`;
	await orderLineRow.nth(0).getByRole("cell").nth(4).getByText(l1PriceUpdated).waitFor();

	// The reconciliation button reads "Reconcile" -- not yet reconciled
	await page.getByRole("button", { name: "View Reconciliation", exact: true }).waitFor({ state: "detached" });
	await page.getByRole("button", { name: "Reconcile", exact: true }).click();

	// The reconciliation order should be created
	await page.waitForURL(`${baseURL}orders/suppliers/reconcile/**`);
	const reconOrderId = page.url().split("/").filter(Boolean).pop();

	// Navigate back to the order (now the reconciliation order had been created)
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByRole("button", { name: "Reconciling", exact: true }).click();
	await page.getByText(`#${order.id}`).click();
	await page.waitForURL(`${baseURL}orders/suppliers/orders/${order.id}/`);

	// The reconciliation button now reads 'View Reconciliation'
	await page.getByRole("button", { name: "Reconcile", exact: true }).waitFor({ state: "detached" });
	await page.getByRole("button", { name: "View Reconciliation", exact: true }).click();

	// Should navigate to (existing) reconciliation order
	await page.waitForURL(`${baseURL}orders/suppliers/reconcile/${reconOrderId}/`);

	// Check reconciliation order reactivity
	//
	// Go back to the supplier order
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByRole("button", { name: "Reconciling", exact: true }).click();
	await page.getByText(`#${order.id}`).click();

	// The reconciliation button reads 'View Reconciliation' (reconciliation order exists)
	await page.getByRole("button", { name: "Reconcile", exact: true }).waitFor({ state: "detached" });
	await page.getByRole("button", { name: "View Reconciliation", exact: true }).waitFor();

	// Delete the reconciliation order (programatically, testing db reactivity)
	await (await getDbHandle(page)).evaluate(deleteReconciliationOrder, Number(reconOrderId));

	// The reconciliation button reads 'Reconcile' (reconciliation was removed)
	await page.getByRole("button", { name: "Reconcile", exact: true }).waitFor();
	await page.getByRole("button", { name: "View Reconciliation", exact: true }).waitFor({ state: "detached" });
});
