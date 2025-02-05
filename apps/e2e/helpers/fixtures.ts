import { baseURL } from "@/integration/constants";
import test from "@playwright/test";
import { addBooksToCustomer, associatePublisher, upsertBook, upsertCustomer, upsertSupplier } from "./cr-sqlite";
import { getDbHandle } from "./db";

type OrderTestFixture = {
	customer: { id: number; fullname: string; email: string; displayId: string };
	books: { isbn: string; authors: string; title: string; publisher: string; price: number }[];
	supplier: { id: number; name: string; email: string };
};

export const testOrders = test.extend<OrderTestFixture>({
	customer: async ({ page }, use) => {
		await page.goto(baseURL);

		const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" };

		const dbHandle = await getDbHandle(page);

		// dbHandler
		await dbHandle.evaluate(upsertCustomer, customer);

		await use(customer);
	},
	books: async ({ page }, use) => {
		await page.goto(baseURL);

		const books = [
			{ isbn: "1234", authors: "author1", title: "title1", publisher: "pub1", price: 10 },
			{ isbn: "4321", authors: "author2", title: "title2", publisher: "pub2", price: 20 }
		];
		const dbHandle = await getDbHandle(page);

		// dbHandler
		await dbHandle.evaluate(upsertBook, books[0]);
		await dbHandle.evaluate(upsertBook, books[1]);

		await use(books);
	},
	supplier: async ({ page }, use) => {
		await page.goto(baseURL);

		const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com", displayId: "1" };
		const supplier = { id: 1, name: "Sup1", email: "sup1@gmail.com" };

		const dbHandle = await getDbHandle(page);

		// dbHandler
		await dbHandle.evaluate(upsertCustomer, customer);
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234"] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234", "4321"] });

		await dbHandle.evaluate(upsertSupplier, supplier);

		await dbHandle.evaluate(associatePublisher, { supplierId: 1, publisherId: "pub1" });
		await dbHandle.evaluate(upsertBook, { isbn: "1234", title: "Book1", authors: "Author1", publisher: "pub1", price: 12 });

		await dbHandle.evaluate(upsertBook, { isbn: "4321", title: "Book2", authors: "Author2", publisher: "pub1", price: 13 });

		await use(supplier);
	}
});
