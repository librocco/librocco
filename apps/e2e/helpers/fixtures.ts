import { baseURL } from "@/integration/constants";
import test from "@playwright/test";
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

type OrderTestFixture = {
	customer: { id: number; fullname: string; email: string; displayId: string };
	books: { isbn: string; authors: string; title: string; publisher: string; price: number }[];
	customerOrderLines: DBCustomerOrderLine[];
};

const books = [
	{ isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10 },
	{ isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20 }
];

const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" };
const supplier = { id: 1, name: "sup1" };
export const testOrders = test.extend<OrderTestFixture>({
	customer: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);

		// dbHandler
		await dbHandle.evaluate(upsertCustomer, customer);

		await use(customer);
	},
	books: async ({ page }, use) => {
		await page.goto(baseURL);

		const dbHandle = await getDbHandle(page);

		// dbHandler
		await dbHandle.evaluate(upsertBook, books[0]);
		await dbHandle.evaluate(upsertBook, books[1]);

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
	}
});
