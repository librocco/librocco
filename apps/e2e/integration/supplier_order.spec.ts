import { expect } from "@playwright/test";

import { appHash } from "@/constants";
import {
	getDbHandle,
	addBooksToCustomer,
	associatePublisher,
	createReconciliationOrder,
	createSupplierOrder,
	deleteReconciliationOrder,
	finalizeReconciliationOrder,
	upsertBook
} from "@/helpers/cr-sqlite";
import { depends, testOrders } from "@/helpers/fixtures";

testOrders("should show empty state when no supplier orders exist", async ({ page, t }) => {
	const { supplier_orders_page: tSupplierOrders } = t;
	await page.goto(appHash("supplier_orders"));

	await expect(page.getByRole("table")).not.toBeVisible();
	await expect(page.getByText(tSupplierOrders.placeholder.title())).toBeVisible();
	await expect(page.getByText(tSupplierOrders.placeholder.description())).toBeVisible();

	const createOrderButton = page.getByRole("button", { name: tSupplierOrders.placeholder.button() });
	await expect(createOrderButton).toBeVisible();

	await createOrderButton.click();

	await expect(page.getByRole("dialog")).toBeVisible();
});

testOrders("order tabs (filters): shows completed orders under 'completed' tab", async ({ page, supplierOrders, t }) => {
	const { supplier_orders_page: tSupplierOrders } = t;
	await page.goto(appHash("supplier_orders"));

	const dbHandle = await getDbHandle(page);

	// The tab should be disabled - no completed orders
	await expect(page.getByRole("button", { name: tSupplierOrders.tabs.completed(), exact: true })).toBeDisabled();

	// Complete two orders - create a reconciliation order and finalize it
	const [o1, o2] = supplierOrders;
	await dbHandle.evaluate(createReconciliationOrder, { id: 1, supplierOrderIds: [o1.order.id, o2.order.id] });
	await dbHandle.evaluate(finalizeReconciliationOrder, 1);

	// Check the 'Completed' view
	await page.getByRole("button", { name: tSupplierOrders.tabs.completed(), exact: true }).click();

	await page.getByRole("table").getByRole("row").nth(2).waitFor();
});

testOrders("should show list of unordered orders", async ({ page, suppliers: [supplier], books, t }) => {
	const { supplier_orders_page: tSupplierOrders } = t;
	await page.goto(appHash("supplier_orders"));

	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });
	await dbHandle.evaluate(associatePublisher, { supplierId: supplier.id, publisher: "pub1" });

	await page.goto(appHash("supplier_orders"));
	page.getByRole("button", { name: tSupplierOrders.tabs.unordered() });

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
		await page.goto(appHash("supplier_orders"));

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

		await page.goto(appHash("supplier_orders"));

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

		await page.waitForURL(appHash("supplier_orders"));
		page.getByRole("button", { name: "Ordered" }).nth(1).click();

		await expect(page.getByText(supplier.name)).toBeVisible();
		await expect(page.getByText("reconcile")).toBeVisible();

		await page.goto(appHash("supplier_orders"));
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

testOrders(
	"new order: selects fractions based on price + uses row checkbox to toggle between full and empty state for the line",
	async ({ page, books, suppliersWithPublishers, customerOrderLines, t }) => {
		const { new_order_page: tNewOrder, supplier_orders_component: tSupplierOrdersComponent } = t;
		depends(customerOrderLines);

		const suppliers = suppliersWithPublishers;

		const table = page.getByRole("table");

		await page.goto(appHash("supplier_orders"));

		// NOTE: this should be unnecessary once the reactivity fix is in
		await page.reload();
		await page.waitForTimeout(500);

		// Use supplier 1 for the test
		await table
			.getByRole("row")
			.filter({ hasText: suppliers[0].name })
			.getByRole("button", { name: tSupplierOrdersComponent.unordered_table.place_order() })
			.click();

		// The state should show all possible order lines, with ordered quantity/total price and selected quantity/total price
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

		// All checkboxes should be checked by default
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked();
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked();
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).toBeChecked();
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).toBeChecked();

		// Select 1/4 = total price (200) / 4 = 50
		await page.getByText(tNewOrder.labels.select() + " 1/4").click();

		// books[0] - isbn: "1234", ordered: 2, selected: 2 -- running total price: 20
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked();

		// books[2] - isbn: "5678", ordered: 2 selected: 0 -- not selected
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).not.toBeChecked();

		// books[6] - isbn: "7777", ordered: 1, selected: 0
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).not.toBeChecked();

		// books[4] - isbn: "9999", ordered: 1, selected 0
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).not.toBeChecked();

		// Select 1/2 = total price (200) / 2 = 100
		await page.getByText(tNewOrder.labels.select() + " 1/2").click();

		// books[0] - isbn: "1234", ordered: 2, selected: 2 -- running total price: 20
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked();

		// books[2] - isbn: "5678", ordered: 2 selected: 2 -- running total price: 80
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked();

		// books[6] - isbn: "7777", ordered: 1, selected: 0 -- adding next one would make the total price 150 (>100) -- STOP HERE
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).not.toBeChecked();

		// books[4] - isbn: "9999", ordered: 1, selected 0
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).not.toBeChecked();

		// Select 3/4 = total price (200) * 3 / 4 = 150
		await page.getByText(tNewOrder.labels.select() + " 3/4").click();

		// books[0] - isbn: "1234", ordered: 2, selected: 2 -- running total price: 20
		await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked();

		// books[2] - isbn: "5678", ordered: 2 selected: 2 -- running total price: 80
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked();

		// books[6] - isbn: "7777", ordered: 1, selected: 1 -- running total price: 150 (END HERE)
		await expect(possibleOrderRow.nth(2).getByRole("checkbox")).toBeChecked();

		// books[4] - isbn: "9999", ordered: 1, selected 0
		await expect(possibleOrderRow.nth(3).getByRole("checkbox")).not.toBeChecked();

		// Toggle checkbox for a row - should deselect it
		await possibleOrderRow.nth(1).getByRole("checkbox").click();
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).not.toBeChecked();

		// Toggle checkbox again - should select it
		await possibleOrderRow.nth(1).getByRole("checkbox").click();
		await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked();
	}
);

// NOTE: skipped as test tests for a stale functionality and one we haven't defined all to well yet
// TODO: revisit when defining the functionality
testOrders.skip(
	"should view reconciliation controls for orders already in reconciliation",
	async ({ page, suppliers: [supplier], books, t }) => {
		const { supplier_orders_component: tSupplierOrdersComponent } = t;
		await page.goto(appHash("supplier_orders"));

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
		await page.goto(appHash("suppliers", supplier.id));

		// Get the table rows for both orders
		const table = page.getByRole("table");
		const rows = table.getByRole("row");

		// First order (in reconciliation) should have disabled controls
		const reconciledRow = rows.nth(2);

		await expect(reconciledRow.getByRole("button", { name: tSupplierOrdersComponent.ordered_table.view_reconciliation() })).toBeVisible();
		await expect(reconciledRow.getByRole("checkbox")).toBeDisabled();

		// Second order (not in reconciliation) should have enabled controls
		const normalRow = rows.nth(1);
		await expect(normalRow.getByRole("checkbox")).toBeEnabled();
		await expect(normalRow.getByRole("button", { name: tSupplierOrdersComponent.ordered_table.reconcile() })).toBeEnabled();
	}
);

// NOTE: skipped as test expects a stale functionality
// TODO: consider when refactoring tests
testOrders.skip(
	"should show correct batch reconciliation state with mixed reconciliation status",
	async ({ page, suppliers: [supplier], books, t }) => {
		const { supplier_orders_component: tSupplierOrdersComponent } = t;
		await page.goto(appHash("supplier_orders"));

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

		await page.goto(appHash("suppliers", supplier.id));

		// Select the two non-reconciled orders
		const table = page.getByRole("table");
		const rows = table.getByRole("row");

		// First order checkbox should be disabled (already in reconciliation)
		await expect(rows.nth(3).getByRole("checkbox")).toBeDisabled();

		// Select the other two orders
		// And mark them for reconciliation
		await rows.nth(1).getByRole("checkbox").click();
		await rows.nth(2).getByRole("checkbox").click();

		// Their individual reconcile buttons should be disabled
		await expect(rows.nth(1).getByRole("button", { name: tSupplierOrdersComponent.ordered_table.reconcile() })).toBeDisabled();
		await expect(rows.nth(2).getByRole("button", { name: tSupplierOrdersComponent.ordered_table.reconcile() })).toBeDisabled();
		// and the "view reconciliation" button in the "already reconciling" row too... just because it looks better
		await expect(rows.nth(3).getByRole("button", { name: tSupplierOrdersComponent.ordered_table.view_reconciliation() })).toBeDisabled();

		// Verify batch reconciliation button appears and is enabled
		const batchReconcileButton = page.getByRole("button", {
			name: tSupplierOrdersComponent.ordered_table.reconcile_selected({ count: 2 })
		});
		await expect(batchReconcileButton).toBeVisible();
		await expect(batchReconcileButton).toBeEnabled();
	}
);

testOrders("new order: empty state", async ({ page, books, suppliersWithPublishers, customerOrderLines, t }) => {
	const { supplier_orders_component: tSupplierOrdersComponent } = t;
	const suppliers = suppliersWithPublishers;

	const table = page.getByRole("table");

	await page.goto(appHash("supplier_orders"));

	// NOTE: this should be unnecessary once the reactivity fix is in
	await page.reload();
	await page.waitForTimeout(500);

	// Use supplier 1 for the test
	await table
		.getByRole("row")
		.filter({ hasText: suppliers[0].name })
		.getByRole("button", { name: tSupplierOrdersComponent.unordered_table.place_order() })
		.click();

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
	await expect(possibleOrderRow.nth(0).getByRole("checkbox")).toBeChecked();
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(1)).toHaveText(books[0].isbn);
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(2)).toHaveText(books[0].title);
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(3)).toHaveText(books[0].authors);
	// Possible (ordered) quantity
	const book1OrderedQuantity = customerOrderLines.byIsbn[books[0].isbn];
	const book1OrderedPrice = (book1OrderedQuantity * books[0].price).toFixed(2);
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(4)).toHaveText(book1OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(0).getByRole("cell").nth(5)).toHaveText(`€${book1OrderedPrice}`);

	// books[2] - isbn: "5678", title: "title3", authors: "author3", price: 30, quantity: 2
	//
	// NOTE: cells are offset by 1 - checkbox
	await expect(possibleOrderRow.nth(1).getByRole("checkbox")).toBeChecked();
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(1)).toHaveText(books[2].isbn);
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(2)).toHaveText(books[2].title);
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(3)).toHaveText(books[2].authors);
	// Possible (ordered) quantity
	const book2OrderedQuantity = customerOrderLines.byIsbn[books[2].isbn];
	const book2OrderedPrice = (book2OrderedQuantity * books[2].price).toFixed(2);
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(4)).toHaveText(book2OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(1).getByRole("cell").nth(5)).toHaveText(`€${book2OrderedPrice}`);

	// books[6] - isbn: "7777", title: "title7", authors: "author7", price: 70, quantity: 1
	//
	// NOTE: cells are offset by 1 - checkbox
	await expect(possibleOrderRow.nth(2).getByRole("checkbox")).toBeChecked();
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(1)).toHaveText(books[6].isbn);
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(2)).toHaveText(books[6].title);
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(3)).toHaveText(books[6].authors);
	// Possible (ordered) quantity
	const book3OrderedQuantity = customerOrderLines.byIsbn[books[6].isbn];
	const book3OrderedPrice = (book3OrderedQuantity * books[6].price).toFixed(2);
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(4)).toHaveText(book3OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(2).getByRole("cell").nth(5)).toHaveText(`€${book3OrderedPrice}`);

	// books[4] - isbn: "9999", title: "title5", authors: "author5", price: 50, quantity: 1
	//
	// NOTE: cells are offset by 1 - checkbox
	await expect(possibleOrderRow.nth(3).getByRole("checkbox")).toBeChecked();
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(1)).toHaveText(books[4].isbn);
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(2)).toHaveText(books[4].title);
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(3)).toHaveText(books[4].authors);
	// Possible (ordered) quantity
	const book4OrderedQuantity = customerOrderLines.byIsbn[books[4].isbn];
	const book4OrderedPrice = (book4OrderedQuantity * books[4].price).toFixed(2);
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(4)).toHaveText(book4OrderedQuantity.toString());
	await expect(possibleOrderRow.nth(3).getByRole("cell").nth(5)).toHaveText(`€${book4OrderedPrice}`);
});

testOrders("supplier order page: view + reactivity", async ({ page, books, supplierOrders, t }) => {
	const {
		reconciled_list_page: tReconciledList,
		supplier_orders_component: tSupplierOrdersComponent,
		supplier_orders_page: tSupplierOrders
	} = t;
	await page.goto(appHash("supplier_orders"));

	const table = page.getByRole("table");

	await page.getByRole("button", { name: tSupplierOrders.tabs.ordered(), exact: true }).click();

	// NOTE: using the first order (from the fixture) for the test
	const { order, lines } = supplierOrders[0];
	await table
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { name: `#${order.id}`, exact: true }) })
		.filter({ has: page.getByRole("cell", { name: order.supplier_name, exact: true }) })
		.getByRole("button", { name: tSupplierOrdersComponent.ordered_table.view_order() })
		.click();

	// Wait for navigation
	await page.waitForURL(appHash("supplier_orders", order.id));

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
	await page.getByRole("button", { name: tSupplierOrdersComponent.ordered_table.view_reconciliation() }).waitFor({ state: "detached" });
	await page.getByRole("button", { name: tReconciledList.labels.reconcile() }).click();

	// The reconciliation order should be created
	await page.waitForURL(appHash("reconcile", "**"));
	const reconOrderId = page.url().split("/").filter(Boolean).pop();

	// Navigate back to the order (now the reconciliation order had been created)
	await page.goto(appHash("supplier_orders"));
	await page.getByRole("button", { name: "Reconciling" }).click();
	await page.getByRole("link", { name: `#${order.id}` }).click();
	await page.waitForURL(appHash("supplier_orders", order.id));

	// The reconciliation button now reads 'View Reconciliation'
	await page.getByRole("button", { name: tReconciledList.labels.reconcile() }).waitFor({ state: "detached" });
	await page.getByRole("button", { name: tReconciledList.labels.view_reconciliation() }).click();

	// Should navigate to (existing) reconciliation order
	await page.waitForURL(appHash("reconcile", reconOrderId));

	// Check reconciliation order reactivity
	//
	// Go back to the supplier order
	await page.goto(appHash("supplier_orders"));
	await page.getByRole("button", { name: "Reconciling" }).click();
	await page.getByRole("link", { name: `#${order.id}` }).click();

	// The reconciliation button reads 'View Reconciliation' (reconciliation order exists)
	await page.getByRole("button", { name: tReconciledList.labels.reconcile() }).waitFor({ state: "detached" });
	await page.getByRole("button", { name: tReconciledList.labels.view_reconciliation() }).waitFor();

	// Delete the reconciliation order (programatically, testing db reactivity)
	await (await getDbHandle(page)).evaluate(deleteReconciliationOrder, Number(reconOrderId));

	// The reconciliation button reads 'Reconcile' (reconciliation was removed)
	await page.getByRole("button", { name: tReconciledList.labels.reconcile() }).waitFor();
	await page.getByRole("button", { name: tReconciledList.labels.view_reconciliation() }).waitFor({ state: "detached" });
});
testOrders(
	"placing orders should be disabled for suppliers without a format configured",
	async ({ page, books, suppliersWithPublishers, customerOrderLines, t }) => {
		const { new_order_page: tNewOrder, supplier_orders_component: tSupplierOrdersComponent } = t;
		depends(customerOrderLines);

		const suppliers = suppliersWithPublishers;

		const table = page.getByRole("table");

		await page.goto(appHash("supplier_orders"));

		// Use supplier3 for the test
		await table
			.getByRole("row")
			.filter({ hasText: suppliers[2].name })
			.getByRole("button", { name: tSupplierOrdersComponent.unordered_table.place_order() })
			.click();

		const isbnRegex = new RegExp(`(${books.map(({ isbn }) => isbn).join("|")})`);
		const possibleOrderRow = table.getByRole("row").filter({ hasText: isbnRegex });

		await expect(possibleOrderRow).toHaveCount(4);
		await expect(page.getByRole("button", { name: tSupplierOrdersComponent.unordered_table.place_order() })).toBeDisabled();
		// hover over the button
		page.getByTestId("tooltip-trigger").hover();
		await expect(page.getByTestId("tooltip-container")).toContainText(tNewOrder.labels.no_format_tooltip());
	}
);

testOrders("should allow placing order for General supplier", async ({ page, books: [book1, book2], t }) => {
	const { supplier_orders_page: tSupplierOrders, supplier_orders_component: tSupplierOrdersComponent } = t;
	const dbHandle = await getDbHandle(page);

	// Setup: Books in customer orders, no publisher associations
	// This will create unordered lines for the General supplier
	await dbHandle.evaluate(addBooksToCustomer, {
		customerId: 1,
		bookIsbns: [book1.isbn, book2.isbn]
	});

	// Navigate to unordered orders
	await page.goto(appHash("supplier_orders"));
	await page.getByRole("button", { name: tSupplierOrders.tabs.unordered() }).click();

	// Verify General supplier appears in the table
	const table = page.getByRole("table");
	await expect(table.getByRole("cell", { name: "General" })).toBeVisible();

	// Click "Place Order" for General supplier
	await table
		.getByRole("row")
		.filter({ hasText: "General" })
		.getByRole("button", { name: tSupplierOrdersComponent.unordered_table.place_order() })
		.click();

	// Verify new-order page loads
	await expect(page).toHaveURL(new RegExp("/orders/suppliers/null/new-order"));

	// Verify books are shown
	const isbnRegex = new RegExp(`(${[book1.isbn, book2.isbn].join("|")})`);
	const possibleOrderRow = table.getByRole("row").filter({ hasText: isbnRegex });
	await expect(possibleOrderRow).toHaveCount(2);

	// Verify supplier name is shown
	await expect(page.getByText("General")).toBeVisible();
});
