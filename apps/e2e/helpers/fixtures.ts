import { baseURL } from "@/integration/constants";
import test from "@playwright/test";
import {
	associatePublisher,
	upsertBook,
	upsertCustomer,
	addBooksToCustomer,
	upsertSupplier,
	createSupplierOrder,
	getPlacedSupplierOrderLines,
	getPlacedSupplierOrders
} from "./cr-sqlite";
import { getDbHandle } from "./db";
import { PlacedSupplierOrderLine } from "./types";

type OrderTestFixture = {
	customer: { id: number; fullname: string; email: string; displayId: string };
	books: { isbn: string; authors: string; title: string; publisher: string; price: number }[];
	placedOrderLines: PlacedSupplierOrderLine[];
};
const books = [
	{ isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10 },
	{ isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20 },
	{ isbn: "5678", authors: "author3", title: "title3", publisher: "pub1", price: 30 }
];
const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" };
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
		await dbHandle.evaluate(upsertBook, books[2]);

		await use(books);
	},
	placedOrderLines: async ({ page }, use) => {
		await page.goto(baseURL);
		const dbHandle = await getDbHandle(page);

		// await dbHandle.evaluate(upsertCustomer, customer);

		// await dbHandle.evaluate(upsertBook, books[0]);
		// await dbHandle.evaluate(upsertBook, books[1]);

		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[2].isbn] });

		await dbHandle.evaluate(upsertSupplier, { id: 1, name: "sup1" });
		await dbHandle.evaluate(associatePublisher, { supplierId: 1, publisherId: "pub1" });

		await dbHandle.evaluate(createSupplierOrder, [{ ...books[0], supplier_id: 1, supplier_name: "sup1", quantity: 1, line_price: 10 }]);
		const placedOrders = await dbHandle.evaluate(getPlacedSupplierOrders);

		const orderIds = placedOrders.map((order) => order.id);
		const placedOrderLines = await dbHandle.evaluate(getPlacedSupplierOrderLines, orderIds);
		/** @TODO replace with supplier id when supplier_order spec is merged in */
		await use(placedOrderLines);
	}
});
