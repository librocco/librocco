import { expect } from "@playwright/test";

import { baseURL } from "../constants";

import { addBooksToCustomer, associatePublisher, getDbHandle, upsertSupplier } from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";

// NOTE: This test depends on fixtures very loosely as the fixtures are currently too convoluted to fine grain.
// The majority of test setup is done within the test code, TODO: update this when we have time to better organize the fixtures

testOrders(
	"unordered: reacts to updates to suppliers, customer order lines and publisher association",
	async ({ page, books, customers, suppliers }) => {
		// Setup, TODO: this should all probably be a fixture
		await page.goto(`${baseURL}orders/suppliers/orders/`);

		const dbHandle = await getDbHandle(page);
		const table = page.getByRole("table");

		// Check that the page is loaded
		await page.getByRole("button", { name: "Unordered", exact: true }).waitFor();

		// There should be no possible orders
		//
		// Possible orders are matched by the respective supplier name (or 'General' for null supplier)
		const possibleOrderRegex = new RegExp(`(${["General", ...suppliers.map(({ name }) => name)].join("|")})`);
		const possibleOrderRow = table.getByRole("row").filter({ hasText: possibleOrderRegex });
		await possibleOrderRow.waitFor({ state: "detached" });

		// Adding a book to customer order should create a possible order ('General' as no publishers are associated with suppliers)
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[0].id, bookIsbns: [books[0].isbn] });

		// Shows the possible order with 1 (potential) book
		await table.getByRole("row").filter({ hasText: "General" }).getByRole("cell", { name: "1", exact: true }).waitFor();

		// Add another book to the order
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[0].id, bookIsbns: [books[1].isbn] });

		// Shows the possible order with 2 (potential) books
		await table.getByRole("row").filter({ hasText: "General" }).getByRole("cell", { name: "2", exact: true }).waitFor();

		// Associate a publisher with supplier 1
		// NOTE: At the time of this writing, books[0] and books[1] had different publishers
		await dbHandle.evaluate(associatePublisher, { supplierId: suppliers[0].id, publisher: books[0].publisher });

		// The possible orders should be split between "General" pseudo-supplier and supplier 1
		await table.getByRole("row").filter({ hasText: "General" }).getByRole("cell", { name: "1", exact: true }).waitFor();
		await table.getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("cell", { name: "1", exact: true }).waitFor();

		// Changing the supplier name is reflected in the table
		await dbHandle.evaluate(upsertSupplier, { ...suppliers[0], name: "New Supplier Name" });
		await table.getByRole("row").filter({ hasText: "General" }).getByRole("cell", { name: "1", exact: true }).waitFor();
		await table.getByRole("row").filter({ hasText: "New Supplier Name" }).getByRole("cell", { name: "1", exact: true }).waitFor();
	}
);
