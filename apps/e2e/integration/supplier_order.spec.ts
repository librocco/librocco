import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDbHandle } from "@/helpers";
import {
	addBooksToCustomer,
	associatePublisher,
	createReconciliationOrder,
	createSupplierOrder,
	finalizeReconciliationOrder
} from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";

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

testOrders(
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

testOrders("should show a placed supplier order with the correct details", async ({ page, books, suppliers: [supplier] }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);

	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(createSupplierOrder, {
		id: 1,
		supplierId: supplier.id,
		orderLines: [{ supplier_id: supplier.id, isbn: books[0].isbn, quantity: 1 }]
	});

	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByRole("button", { name: "Ordered" }).nth(1).click();

	const updateButton = page.getByRole("button", { name: "View Order" }).first();
	await updateButton.click();

	await expect(page.getByText(supplier.name)).toBeVisible();
	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	await expect(firstRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].authors })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].title })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: `${books[0].price}` })).toBeVisible();
});

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
