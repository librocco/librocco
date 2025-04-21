import { DB } from "@vlcn.io/crsqlite-wasm";
import test, { JSHandle } from "@playwright/test";

import { BookData, wrapIter, TranslationFunctions, Locales } from "@librocco/shared";

import { Customer, Supplier } from "./types";

import { baseURL } from "@/integration/constants";
import { loadLocale } from "@librocco/shared/i18n-util.sync";
import { i18nObject } from "@librocco/shared/i18n-util";

import {
	addBooksToCustomer,
	upsertReconciliationOrderLines,
	associatePublisher,
	createReconciliationOrder,
	createSupplierOrder,
	finalizeReconciliationOrder,
	upsertBook,
	upsertCustomer,
	upsertSupplier,
	Warehouse,
	upsertWarehouse
} from "./cr-sqlite";
import { getDbHandle } from "./db";

const books = [
	{ isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10 },
	{ isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20 },
	{ isbn: "5678", authors: "author3", title: "title3", publisher: "pub1", price: 30 },
	{ isbn: "8765", authors: "author4", title: "title4", publisher: "pub2", price: 40 },
	{ isbn: "9999", authors: "author5", title: "title5", publisher: "pub1", price: 50 },
	{ isbn: "8888", authors: "author6", title: "title6", publisher: "pub2", price: 60 },
	{ isbn: "7777", authors: "author7", title: "title7", publisher: "pub1", price: 70 }
];
const warehouses = [
	{ id: 1, displayName: "Warehouse 1", discount: 10 },
	{ id: 2, displayName: "Warehouse 2", discount: 15 },
	{ id: 3, displayName: "Warehouse 3", discount: 20 }
];

const suppliers = [
	{ id: 1, name: "sup1", email: "sup1@gmail.com" },
	{ id: 2, name: "sup2" }
];

const suppliersWithPublishers = [
	{ ...suppliers[0], publishers: ["pub1"] },
	{ ...suppliers[1], publishers: ["pub2"] }
];

const customers = [
	{ id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" },
	{ id: 2, fullname: "Jane Doe", email: "jane@gmail.com", displayId: "2" },
	{ id: 3, fullname: "Don Joe", displayId: "3" }
];

const customerOrderLines = [
	{ customerId: 1, isbn: "1234" },
	{ customerId: 1, isbn: "5678" },
	{ customerId: 1, isbn: "8888" },
	{ customerId: 2, isbn: "5678" },
	{ customerId: 2, isbn: "8765" },
	{ customerId: 2, isbn: "4321" },
	{ customerId: 2, isbn: "7777" },
	{ customerId: 3, isbn: "1234" },
	{ customerId: 3, isbn: "9999" }
];

type FixtureCustomerOrderLines = {
	/** Record of { isbn => total quantity } */
	byIsbn: Record<string, number>;
	/** A groupped list of { customerId, isbns } for each order */
	byOrder: { customerId: number; isbns: string[] }[];
	/** A raw list of customer order lines */
	lines: { isbn: string; customerId: number }[];
};

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
		totalBooks: number;
	};
	lines: FixtureSupplierOrderLine[];
};

const supplierOrders: FixtureSupplierOrder[] = [
	{
		order: { id: 1, supplier_id: 1, supplier_name: "sup1", totalBooks: 3 },
		lines: [
			{ isbn: "1234", supplier_id: 1, supplier_name: "sup1", quantity: 2 },
			{ isbn: "5678", supplier_id: 1, supplier_name: "sup1", quantity: 1 }
		]
	},
	{
		order: { id: 2, supplier_id: 1, supplier_name: "sup1", totalBooks: 6 },
		lines: [
			{ isbn: "5678", supplier_id: 1, supplier_name: "sup1", quantity: 3 },
			{ isbn: "9999", supplier_id: 1, supplier_name: "sup1", quantity: 2 },
			{ isbn: "7777", supplier_id: 1, supplier_name: "sup1", quantity: 1 }
		]
	},
	{
		order: { id: 3, supplier_id: 2, supplier_name: "sup2", totalBooks: 3 },
		lines: [
			{ isbn: "4321", supplier_id: 2, supplier_name: "sup2", quantity: 1 },
			{ isbn: "8765", supplier_id: 2, supplier_name: "sup2", quantity: 1 },
			{ isbn: "8888", supplier_id: 2, supplier_name: "sup2", quantity: 1 }
		]
	}
];

type InventoryTestFixture = {
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
	warehouses: Warehouse[];
	t: TranslationFunctions;
	locale: Locales;
};
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
	 * id: 3, fullname: "Don Joe",  displayId: "3"
	 */
	customers: Customer[];

	/**
	 * Depends: books
	 * Depends: customers
	 * Depends: suppliers
	 * Depedns: suppliersWithPublishers
	 *
	 * Data:
	 *
	 * isbn: "1234", customerId: 1, status: delivered
	 * isbn: "4321", customerId: 1, status: placed
	 *
	 * NOTE: This fixture is used in only one test - TODO: replace with more modular approach
	 */
	collectCustomerOrderLine: FixtureCustomerOrderLines["lines"];

	/**
	 * Depends: books
	 * Depedns: customers
	 *
	 * Data:
	 *
	 * customerId: 1, isbn: "1234"
	 * customerId: 1, isbn: "5678"
	 * customerId: 1, isbn: "8888"
	 * customerId: 2, isbn: "5678"
	 * customerId: 2, isbn: "8765"
	 * customerId: 2, isbn: "4321"
	 * customerId: 2, isbn: "7777"
	 * customerId: 3, isbn: "1234"
	 * customerId: 3, isbn: "9999"
	 */
	customerOrderLines: FixtureCustomerOrderLines;

	/**
	 * Data:
	 *
	 * id: 1, name: "sup1", email: "sup1@gmail.com"
	 * id: 2, name: "sup2", email: "sup2@gmail.com"
	 */
	suppliers: Supplier[];

	/**
	 * Depends: suppliers
	 *
	 * Data:
	 *
	 * id: 1, name: "sup1", email: "sup1@gmail.com", publishers: ["pub1"]
	 * id: 2, name: "sup2", email: "sup2@gmail.com", publishers: ["pub2"]
	 */
	suppliersWithPublishers: Array<Supplier & { publishers: string[] }>;

	/**
	 * Depends: books
	 * Depends: suppliers
	 * Depends: suppliersWithPublishers
	 * Depends: customers
	 * Depends: customerOrderLines
	 *
	 * Data:
	 *
	 * ID: 1, supplier id: 1
	 *  isbn: "1234", quantity: 2
	 *  isbn: "5678", quantity: 1
	 *
	 * ID: 2, supplier id: 1
	 *  isbn: "5678", quantity: 3
	 *  isbn: "9999", quantity: 2
	 *  isbn: "7777", quantity: 1
	 *
	 * ID: 3, supplier id: 2
	 *  isbn: "4321", quantity: 1
	 *  isbn: "8765", quantity: 1
	 *  isbn: "8888", quantity: 1
	 */
	supplierOrders: FixtureSupplierOrder[];
	t: TranslationFunctions;
	locale: Locales;
};

export const testBase = test.extend({
	page: async ({ page }, use) => {
		const goto = page.goto;

		page.goto = async function (url, opts) {
			// Wait for 100ms, for ongoing IndexedDB transactions to finish
			// This is as dirty as it gets, but is a quick fix to ensure that ongoing txns (such as fixture setups)
			// don't get interrupted on navigation - causing flaky-as-hell tests
			await new Promise((res) => setTimeout(res, 100));

			const res = await goto.call(page, url, opts);

			// https://github.com/sveltejs/kit/pull/6484
			// * this is set in the onMount hook of the root +layout.svelte to indicate when hydration has completed
			await page.waitForSelector('body[hydrated="true"]', { timeout: 10000 });

			return res;
		};

		await use(page);
	}
});

// NOTE: In order to order to avoid circular depenedencies within fixtures, the best prectice is
// for each fixture to depend only on the fixtures that are declared before it.
export const testInventory = testBase.extend<InventoryTestFixture>({
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
	warehouses: async ({ dbHandle }, use) => {
		for (const warehouse of warehouses) {
			await dbHandle.evaluate(upsertWarehouse, warehouse);
		}
		await use(warehouses);
	},
	t: ({ locale }, use) => {
		loadLocale(locale);

		const t = i18nObject(locale);

		use(t);
	}
});

export const testOrders = testBase.extend<OrderTestFixture>({
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
			await dbHandle.evaluate(upsertSupplier, supplier as Supplier);
		}
		await use(suppliers);
	},

	suppliersWithPublishers: async ({ dbHandle, suppliers }, use) => {
		depends(suppliers);

		for (const { publishers, ...supplier } of suppliersWithPublishers) {
			for (const publisher of publishers) {
				await dbHandle.evaluate(associatePublisher, { supplierId: supplier.id, publisher });
			}
		}

		await use(suppliersWithPublishers);
	},

	customers: async ({ dbHandle }, use) => {
		for (const customer of customers) {
			await dbHandle.evaluate(upsertCustomer, customer as Customer);
		}
		await use(customers);
	},

	collectCustomerOrderLine: async ({ dbHandle, books, customers, suppliersWithPublishers }, use) => {
		depends(customers);
		depends(suppliersWithPublishers);

		const customerOrderLines = [
			{ isbn: "1234", customerId: 1 },
			{ isbn: "4321", customerId: 1 }
		];

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
		await dbHandle.evaluate(createSupplierOrder, {
			id: 1,
			supplierId: 1,
			orderLines: [supplierOrderLine]
		});

		await dbHandle.evaluate(createReconciliationOrder, { id: 1, supplierOrderIds: [1] });

		await dbHandle.evaluate(upsertReconciliationOrderLines, { id: 1, newLines: [supplierOrderLine] });
		await dbHandle.evaluate(finalizeReconciliationOrder, 1);

		await use(customerOrderLines);
	},

	customerOrderLines: async ({ dbHandle, books, customers }, use) => {
		depends(books);
		depends(customers);

		const byOrder = [
			...wrapIter(customerOrderLines)
				._group(({ customerId, isbn }) => [customerId, isbn])
				.map(([customerId, isbns]) => ({ customerId, isbns: [...isbns] }))
		];

		const byIsbn = Object.fromEntries(
			wrapIter(customerOrderLines)
				._group(({ isbn }) => [isbn, 1])
				.map(([isbn, lines]) => [isbn, [...lines].length])
		);

		for (const { customerId, isbns: bookIsbns } of byOrder) {
			await dbHandle.evaluate(addBooksToCustomer, { customerId, bookIsbns });
		}

		await use({ byOrder, byIsbn, lines: customerOrderLines });
	},

	supplierOrders: async ({ page, books, customerOrderLines, suppliersWithPublishers }, use) => {
		depends(books);
		depends(customerOrderLines);
		depends(suppliersWithPublishers);

		await page.goto(baseURL);
		const dbHandle = await getDbHandle(page);

		for (const {
			order: { id, supplier_id },
			lines
		} of supplierOrders) {
			await dbHandle.evaluate(createSupplierOrder, { id, supplierId: supplier_id, orderLines: lines });
		}

		await use(supplierOrders);
	},
	t: ({ locale }, use) => {
		loadLocale(locale);

		const t = i18nObject(locale);

		use(t);
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
