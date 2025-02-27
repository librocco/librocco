import { baseURL } from "@/integration/constants";

import { Customer, Supplier } from "./types";
import {
	addBooksToCustomer,
	addOrderLinesToReconciliationOrder,
	associatePublisher,
	createReconciliationOrder,
	createSupplierOrder,
	finalizeReconciliationOrder,
	upsertBook,
	upsertCustomer,
	upsertSupplier
} from "./cr-sqlite";
import { getDbHandle } from "./db";
import test, { JSHandle } from "@playwright/test";
import { DB } from "@vlcn.io/crsqlite-wasm";
import { BookData } from "@librocco/shared";

const books = [
	{ isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10 },
	{ isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20 },
	{ isbn: "5678", authors: "author3", title: "title3", publisher: "pub1", price: 30 },
	{ isbn: "8765", authors: "author4", title: "title4", publisher: "pub2", price: 40 },
	{ isbn: "9999", authors: "author5", title: "title5", publisher: "pub1", price: 50 },
	{ isbn: "8888", authors: "author6", title: "title6", publisher: "pub2", price: 60 },
	{ isbn: "7777", authors: "author7", title: "title7", publisher: "pub1", price: 70 }
];

const suppliers = [{ id: 1, name: "Sup1", email: "sup1@gmail.com" }];

const customers = [
	{ id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" },
	{ id: 2, fullname: "Jane Doe", email: "jane@gmail.com", displayId: "2" },
	{ id: 3, fullname: "Don Joe", email: "don@gmail.com", displayId: "3" }
];

type FixtureCustomerOrderLine = {
	isbn: string;
	customerId: number;
};

const customerOrderLines = [
	{ isbn: "1234", customerId: 1 },
	{ isbn: "4321", customerId: 1 }
];

type FixtureSupplierOrderLine = {
	isbn: string;
	quantity: number;
	supplier_id: number;
	supplier_name: string;
};

type FixtureSupplierOrder = {
	order: {
		id: number;
		supplier_id: number;
		supplier_name: string;
	};
	lines: FixtureSupplierOrderLine[];
};

const supplierOrders: FixtureSupplierOrder[] = [
	{
		order: { id: 1, supplier_id: 1, supplier_name: "sup1" },
		lines: [
			{ isbn: "1234", supplier_id: 1, supplier_name: "sup1", quantity: 2 },
			{ isbn: "5678", supplier_id: 1, supplier_name: "sup1", quantity: 1 }
		]
	},
	{
		order: { id: 2, supplier_id: 1, supplier_name: "sup1" },
		lines: [
			{ isbn: "5678", supplier_id: 1, supplier_name: "sup1", quantity: 3 },
			{ isbn: "9999", supplier_id: 1, supplier_name: "sup1", quantity: 2 },
			{ isbn: "7777", supplier_id: 1, supplier_name: "sup1", quantity: 1 }
		]
	},
	{
		order: { id: 3, supplier_id: 2, supplier_name: "sup2" },
		lines: [
			{ isbn: "4321", supplier_id: 2, supplier_name: "sup2", quantity: 1 },
			{ isbn: "8765", supplier_id: 2, supplier_name: "sup2", quantity: 1 },
			{ isbn: "8888", supplier_id: 2, supplier_name: "sup2", quantity: 1 }
		]
	}
];

type OrderTestFixture = {
	dbHandle: JSHandle<DB>;

	/**
	 * Data:
	 *
	 * isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10
	 * isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20
	 * isbn: "5678", authors: "author3", title: "title3", publisher: "pub1", price: 30
	 * isbn: "8765", authors: "author4", title: "title4", publisher: "pub2", price: 40
	 * isbn: "9999", authors: "author5", title: "title5", publisher: "pub1", price: 50
	 * isbn: "8888", authors: "author6", title: "title6", publisher: "pub2", price: 60
	 * isbn: "7777", authors: "author7", title: "title7", publisher: "pub1", price: 70
	 */
	books: BookData[];

	/**
	 * Data:
	 *
	 * id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1"
	 * id: 2, fullname: "Jane Doe", email: "jane@gmail.com", displayId: "2"
	 * id: 3, fullname: "Don Joe",  email: "don@gmail.com",  displayId: "3"
	 */
	customers: Customer[];

	/**
	 * Data:
	 *
	 * isbn: "1234", customerId: 1, status: delivered
	 * isbn: "4321", customerId: 1, status: placed
	 */
	customerOrderLines: FixtureCustomerOrderLine[];

	/**
	 * Data:
	 *
	 * id: 1, name: "Sup1", email: "sup1@gmail.com"
	 */
	suppliers: Supplier[];

	/**
	 * Data:
	 *
	 * Customer order lines:
	 *	customerId: 1, isbn: "1234"
	 * 	customerId: 1, isbn: "5678"
	 * 	customerId: 1, isbn: "8888"
	 * 	customerId: 2, isbn: "5678"
	 * 	customerId: 2, isbn: "8765"
	 * 	customerId: 2, isbn: "4321"
	 * 	customerId: 2, isbn: "7777"
	 * 	customerId: 3, isbn: "1234"
	 * 	customerId: 3, isbn: "9999"
	 *
	 * Suppliers:
	 *  id: 1, name: "sup1"
	 *  id: 2, name: "sup2"
	 *
	 * Supplier orders:
	 *  ID: 1, supplier id: 1
	 * 	 isbn: "1234", quantity: 2
	 * 	 isbn: "5678", quantity: 1
	 *
	 *  ID: 2, supplier id: 1
	 * 	 isbn: "5678", quantity: 3
	 * 	 isbn: "9999", quantity: 2
	 * 	 isbn: "7777", quantity: 1
	 *
	 *  ID: 3, supplier id: 2
	 * 	 isbn: "4321", quantity: 1
	 * 	 isbn: "8765", quantity: 1
	 * 	 isbn: "8888", quantity: 1
	 */
	supplierOrders: FixtureSupplierOrder[];
};

// NOTE: In order to order to avoid circular depenedencies within fixtures, the best prectice is
// for each fixture to depend only on the fixtures that are declared before it.
export const testOrders = test.extend<OrderTestFixture>({
	dbHandle: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);
		await use(dbHandle);
	},

	books: async ({ dbHandle }, use) => {
		for (const book of books) {
			await dbHandle.evaluate(upsertBook, book);
		}
		await use(books);
	},

	suppliers: async ({ dbHandle }, use) => {
		for (const supplier of suppliers) {
			await dbHandle.evaluate(upsertSupplier, supplier);
		}
		await use(suppliers);
	},

	customers: async ({ dbHandle }, use) => {
		for (const customer of customers) {
			await dbHandle.evaluate(upsertCustomer, customer);
		}
		await use(customers);
	},

	customerOrderLines: async ({ dbHandle, books, customers, suppliers }, use) => {
		depends(customers);
		depends(suppliers);

		const supplierOrderLine = {
			...books[0],
			supplier_id: 1,
			supplier_name: "Sup1",
			quantity: 1,
			line_price: 10
		};

		for (const line of customerOrderLines) {
			await dbHandle.evaluate(addBooksToCustomer, { customerId: line.customerId, bookIsbns: [line.isbn] });
		}

		// TODO: Check this - doesn't seem like a clean, modular setup - we should probably set this up explicitly (SQL)
		// as, to my understanding, the purpose is to get some diversity in order line states
		//
		// NOTE: Alternative would be to move this to a separate fixture. In that case we would need to be careful about the order of fixture execution
		// so as to not create circular dependencies
		await dbHandle.evaluate(associatePublisher, { supplierId: 1, publisherId: "pub1" });
		await dbHandle.evaluate(createSupplierOrder, {
			id: 1,
			supplierId: 1,
			orderLines: [supplierOrderLine]
		});

		const reconciliationOrderId = await dbHandle.evaluate(createReconciliationOrder, [1]);

		await dbHandle.evaluate(addOrderLinesToReconciliationOrder, { id: reconciliationOrderId, newLines: [supplierOrderLine] });
		await dbHandle.evaluate(finalizeReconciliationOrder, reconciliationOrderId);

		await use(customerOrderLines);
	},

	supplierOrders: async ({ page, books }, use) => {
		depends(books);

		await page.goto(baseURL);
		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234", "5678", "8888"] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 2, bookIsbns: ["5678", "8765", "4321", "7777"] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 3, bookIsbns: ["1234", "9999"] });

		await dbHandle.evaluate(upsertSupplier, { id: 1, name: "sup1" });
		await dbHandle.evaluate(upsertSupplier, { id: 2, name: "sup2" });

		await dbHandle.evaluate(associatePublisher, { supplierId: 1, publisherId: "pub1" });
		await dbHandle.evaluate(associatePublisher, { supplierId: 2, publisherId: "pub2" });

		for (const {
			order: { id, supplier_id },
			lines
		} of supplierOrders) {
			await dbHandle.evaluate(createSupplierOrder, { id, supplierId: supplier_id, orderLines: lines });
		}

		await use(supplierOrders);
	}
});

/**
 * This is a noop function used to reference a fixture in case when we want the fixture to run (as a test setup),
 * but we don't use it in the test code block.
 *
 * @example
 *
 * Say we want to use a fixture 'customer' that sets up the DB state with a given customer, we can use the customer to make assertions.
 *
 * ```ts
 * testOrders("customer exists in the DB", async ({page, customer}) => {
 *	 await page.getByText(customer.email);
 * })
 * ```
 *
 * This is all well and great as we're referencing the customer (destructured param from the callback) in the test block:
 * this makes sure the fixture runs before the test block.
 *
 * However, sometimes we want to make sure the fixture runs before the test, but we don't reference it in the test block.
 * ```ts
 * testOrders("customer exists in the DB", async ({page}) => {
 *	 // 'customer' is not referenced here so the fixture won't run
 * })
 * ```
 *
 * Now, we can merely declare the customer without using it, like so:
 * ```ts
 * testOrders("customer exists in the DB", async ({page, customer}) => {})
 * ```
 * But that would cause problems with the linter as it would complain about the unused variable.
 *
 * The cleanest (albeit useless) way to make sure the fixture runs is to use this function as a reference:
 * ```ts
 * testOrders("customer exists in the DB", async ({page, customer}) => {
 *   // This makes the fixture run (setup the DB) without us necessarily referencing the data in the code
 *   // Additinal + IMO is that we explicitly declare which fixtures we depend on - a documentation of sorts
 *   depends(customer);
 * })
 * ```
 *
 */
export const depends = (x: any) => {
	x; // This does nothing
};
