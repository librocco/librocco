import { baseURL } from "@/integration/constants";

import { PlacedSupplierOrder, PlacedSupplierOrderLine } from "./types";
import {
	addBooksToCustomer,
	upsertReconciliationOrderLines,
	associatePublisher,
	createReconciliationOrder,
	createSupplierOrder,
	finalizeReconciliationOrder,
	getCustomerOrderLineStatus,
	getPlacedSupplierOrderLines,
	getPlacedSupplierOrders,
	upsertBook,
	upsertCustomer,
	upsertSupplier
} from "./cr-sqlite";
import { getDbHandle } from "./db";
import { DBCustomerOrderLine } from "./types";
import test, { JSHandle } from "@playwright/test";
import { DB } from "@vlcn.io/crsqlite-wasm";

type OrderTestFixture = {
	customers: { id: number; fullname: string; email: string; displayId: string }[];
	books: { isbn: string; authors: string; title: string; publisher: string; price: number }[];
	placedOrders: {
		order: PlacedSupplierOrder;
		lines: PlacedSupplierOrderLine[];
	}[];
	customerOrderLines: DBCustomerOrderLine[];
	supplier: { id: number; name: string; email: string };
	dbHandle: JSHandle<DB>;
};
const books = [
	{ isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10 },
	{ isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20 },
	{ isbn: "5678", authors: "author3", title: "title3", publisher: "pub1", price: 30 },
	{ isbn: "8765", authors: "author4", title: "title4", publisher: "pub2", price: 40 },
	{ isbn: "9999", authors: "author5", title: "title5", publisher: "pub1", price: 50 },
	{ isbn: "8888", authors: "author6", title: "title6", publisher: "pub2", price: 60 },
	{ isbn: "7777", authors: "author7", title: "title7", publisher: "pub1", price: 70 }
];
const customers = [
	{ id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" },
	{ id: 2, fullname: "Jane Doe", email: "jane@gmail.com", displayId: "2" },
	{ id: 3, fullname: "Don Joe", email: "don@gmail.com", displayId: "3" }
];

const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" };
const supplier = { id: 1, name: "sup1" };
export const testOrders = test.extend<OrderTestFixture>({
	customers: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);

		// dbHandler
		await dbHandle.evaluate(upsertCustomer, customers[0]);
		await dbHandle.evaluate(upsertCustomer, customers[1]);
		await dbHandle.evaluate(upsertCustomer, customers[2]);

		await use(customers);
	},
	books: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(upsertBook, books[0]);
		await dbHandle.evaluate(upsertBook, books[1]);
		await dbHandle.evaluate(upsertBook, books[2]);
		await dbHandle.evaluate(upsertBook, books[3]);
		await dbHandle.evaluate(upsertBook, books[4]);
		await dbHandle.evaluate(upsertBook, books[5]);
		await dbHandle.evaluate(upsertBook, books[6]);

		await use(books);
	},
	placedOrders: async ({ page }, use) => {
		await page.goto(baseURL);
		const dbHandle = await getDbHandle(page);

		// await dbHandle.evaluate(upsertCustomer, customer);

		// await dbHandle.evaluate(upsertBook, books[0]);
		// await dbHandle.evaluate(upsertBook, books[1]);

		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[0].id, bookIsbns: [books[0].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[0].id, bookIsbns: [books[2].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[0].id, bookIsbns: [books[5].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[1].id, bookIsbns: [books[2].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[1].id, bookIsbns: [books[3].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[1].id, bookIsbns: [books[1].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[1].id, bookIsbns: [books[6].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[2].id, bookIsbns: [books[0].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: customers[2].id, bookIsbns: [books[4].isbn] });

		await dbHandle.evaluate(upsertSupplier, { id: 1, name: "sup1" });
		await dbHandle.evaluate(upsertSupplier, { id: 2, name: "sup2" });

		await dbHandle.evaluate(associatePublisher, { supplierId: 1, publisherId: "pub1" });
		await dbHandle.evaluate(associatePublisher, { supplierId: 2, publisherId: "pub2" });

		await dbHandle.evaluate(createSupplierOrder, [
			{ ...books[0], supplier_id: 1, supplier_name: "sup1", quantity: 2, line_price: 20 },
			{ ...books[2], supplier_id: 1, supplier_name: "sup1", quantity: 1, line_price: 30 }
		]);
		await dbHandle.evaluate(createSupplierOrder, [
			{ ...books[2], supplier_id: 1, supplier_name: "sup1", quantity: 3, line_price: 90 },
			{ ...books[4], supplier_id: 1, supplier_name: "sup1", quantity: 2, line_price: 100 },
			{ ...books[6], supplier_id: 1, supplier_name: "sup1", quantity: 1, line_price: 70 }
		]);

		await dbHandle.evaluate(createSupplierOrder, [
			{ ...books[1], supplier_id: 2, supplier_name: "sup2", quantity: 1, line_price: 20 },
			{ ...books[3], supplier_id: 2, supplier_name: "sup2", quantity: 1, line_price: 40 },
			{ ...books[5], supplier_id: 2, supplier_name: "sup2", quantity: 1, line_price: 60 }
		]);

		const placedOrders = await dbHandle.evaluate(getPlacedSupplierOrders);

		const orderIds = placedOrders.map((order) => order.id);
		const placedOrderLines = await dbHandle.evaluate(getPlacedSupplierOrderLines, orderIds);

		// : {order: PlacedSupplierOrder, lines: PlacedSupplierOrderLines}[]
		const orderAndLines = placedOrders.map((order) => ({
			order,
			lines: placedOrderLines.filter((line) => line.supplier_order_id === order.id)
		}));

		/** @TODO replace with supplier id when supplier_order spec is merged in */
		await use(orderAndLines);
	},
	customerOrderLines: async ({ page }, use) => {
		await page.goto(baseURL);

		const supplierOrderLine = { ...books[0], supplier_id: supplier.id, supplier_name: supplier.name, quantity: 1, line_price: 10 };
		const dbHandle = await getDbHandle(page);
		await dbHandle.evaluate(upsertCustomer, customer);

		await dbHandle.evaluate(upsertBook, books[0]);
		await dbHandle.evaluate(upsertBook, books[1]);
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });
		await dbHandle.evaluate(upsertSupplier, supplier);
		await dbHandle.evaluate(associatePublisher, { supplierId: supplier.id, publisherId: "pub1" });
		await dbHandle.evaluate(createSupplierOrder, [supplierOrderLine]);

		const placedOrders = await dbHandle.evaluate(getPlacedSupplierOrders);

		const placedOrderIds = placedOrders.map((placedOrder) => placedOrder.id);
		const reconciliationOrderId = await dbHandle.evaluate(createReconciliationOrder, placedOrderIds);
		await dbHandle.evaluate(upsertReconciliationOrderLines, { id: reconciliationOrderId, newLines: [supplierOrderLine] });
		await dbHandle.evaluate(finalizeReconciliationOrder, reconciliationOrderId);

		const customerOrderLines = await dbHandle.evaluate(getCustomerOrderLineStatus, customer.id);

		await use(customerOrderLines);
	},
	supplier: async ({ page }, use) => {
		await page.goto(baseURL);

		const supplier = { id: 1, name: "Sup1", email: "sup1@gmail.com" };

		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(upsertSupplier, supplier);
		// await dbHandle.evaluate(associatePublisher, { supplierId: 1, publisherId: "pub1" });

		await use(supplier);
	},
	dbHandle: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);
		await use(dbHandle);
	}
});
