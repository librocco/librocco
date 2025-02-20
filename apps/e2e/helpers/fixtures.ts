import { baseURL } from "@/integration/constants";
import {
	addBooksToCustomer,
	addOrderLinesToReconciliationOrder,
	associatePublisher,
	createReconciliationOrder,
	createSupplierOrder,
	finalizeReconciliationOrder,
	getCustomerOrderLineStatus,
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
	customer: { id: number; fullname: string; email: string; displayId: string };
	books: { isbn: string; authors: string; title: string; publisher: string; price: number }[];
	customerOrderLines: DBCustomerOrderLine[];
	supplier: { id: number; name: string; email: string };
	dbHandle: JSHandle<DB>;
};

const books = [
	{ isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10 },
	{ isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20 },
	{ isbn: "5678", authors: "author3", title: "title3", publisher: "pub1", price: 30 }
];

const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" };
const supplier = { id: 1, name: "sup1" };
export const testOrders = test.extend<OrderTestFixture>({
	customer: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);
		await dbHandle.evaluate(upsertCustomer, customer);

		await use(customer);
	},
	books: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(upsertBook, books[0]);
		await dbHandle.evaluate(upsertBook, books[1]);
		await dbHandle.evaluate(upsertBook, books[2]);

		await use(books);
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
		await dbHandle.evaluate(addOrderLinesToReconciliationOrder, { id: reconciliationOrderId, newLines: [supplierOrderLine] });
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
