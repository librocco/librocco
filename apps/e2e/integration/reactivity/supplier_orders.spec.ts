import { appHash } from "@/constants";

import { addBooksToCustomer, associatePublisher, getDbHandle, upsertBook, upsertSupplier } from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";

// NOTE: This test depends on fixtures very loosely as the fixtures are currently too convoluted to fine grain.
// The majority of test setup is done within the test code, TODO: update this when we have time to better organize the fixtures

testOrders(
	"unordered: reacts to updates to suppliers, customer order lines and publisher association",
	async ({ page, books, customers, suppliers }) => {
		await page.goto(appHash("supplier_orders"));

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

testOrders(
	"new order: reacts to updates to relevant customer order lines, supplier info and book data",
	async ({ page, books, customers, suppliers }) => {
		// Setup - add 1 book to customer 0 and associate with supplier 1
		// NOTE: Without doing this, we would get redirected from new-order view

		// Add a book to the customer order
		// NOTE: building dbHandle each time as we'll navigate below and don't want to lose the context
		await getDbHandle(page).then((db) => db.evaluate(addBooksToCustomer, { customerId: customers[0].id, bookIsbns: [books[0].isbn] }));

		// Asociate the book's publisher with supplier 1
		await getDbHandle(page).then((db) => db.evaluate(associatePublisher, { supplierId: suppliers[0].id, publisher: books[0].publisher }));

		// Open a new supplier order view for supplier 1
		await page.goto(appHash("suppliers", suppliers[0].id, "new-order"));

		const dbHandle = await getDbHandle(page);
		const table = page.getByRole("table");

		// Check that the page is loaded
		await page.getByText(suppliers[0].name).waitFor();

		// There should be no possible order lines
		//
		// NOTE: all possible order lines have checkboxes
		const possibleOrderLineRow = table.getByRole("row").filter({ has: page.getByRole("checkbox") });

		// The initial line should be there
		await possibleOrderLineRow.filter({ hasText: books[0].isbn }).getByRole("cell", { name: "1", exact: true }).waitFor();
		// Check total price (1 x book price)
		await possibleOrderLineRow
			.filter({ hasText: books[0].isbn })
			.getByRole("cell", { name: `€${books[0].price}`, exact: true })
			.waitFor();

		// Add a second book to the customer order
		// NOTE: At the time of this writing, books[2] had the same publisher as books[0]
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[0].id, bookIsbns: [books[2].isbn] });
		await possibleOrderLineRow.filter({ hasText: books[2].isbn }).getByRole("cell", { name: "1", exact: true }).waitFor();
		// Check total price (1 x book price)
		await possibleOrderLineRow
			.filter({ hasText: books[2].isbn })
			.getByRole("cell", { name: `€${books[2].price}`, exact: true })
			.waitFor();

		// Change book data for books[0]
		await dbHandle.evaluate(upsertBook, { isbn: books[0].isbn, title: "Book 1 New Title", authors: "Updated authors", price: 1000 });
		await possibleOrderLineRow.filter({ hasText: "Book 1 New Title" }).getByRole("cell", { name: "Updated authors" }).waitFor();
		await possibleOrderLineRow.filter({ hasText: "Book 1 New Title" }).getByRole("cell", { name: "€1000", exact: true }).waitFor(); // Price cell

		// Add one more of books[0] to customers[1] - shold also appear, with adjusted quantity and total price
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[1].id, bookIsbns: [books[0].isbn] });
		await possibleOrderLineRow.filter({ hasText: "Book 1 New Title" }).getByRole("cell", { name: "2", exact: true }).waitFor();
		await possibleOrderLineRow.filter({ hasText: "Book 1 New Title" }).getByRole("cell", { name: "€2000", exact: true }).waitFor(); // Price cell

		// Add books[1] to customers[1] - should not appear yet (before associating the publisher with the supplier)
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[1].id, bookIsbns: [books[1].isbn] });
		await possibleOrderLineRow.filter({ hasText: books[1].isbn }).waitFor({ state: "detached" });

		// Associate the publisher of books[1] with the supplier
		await dbHandle.evaluate(associatePublisher, { supplierId: suppliers[0].id, publisher: books[1].publisher });
		await possibleOrderLineRow.filter({ hasText: books[1].isbn }).getByRole("cell", { name: "1", exact: true }).waitFor();

		// Check supplier info changes
		await dbHandle.evaluate(upsertSupplier, { ...suppliers[0], name: "New Supplier Name" });
		await page.getByText("New Supplier Name").waitFor();
	}
);
