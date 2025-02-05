import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDbHandle } from "@/helpers";
import {
	addBooksToCustomer,
	associatePublisher,
	upsertCustomer,
	upsertSupplier,
	createSupplierOrder,
	upsertBook
} from "@/helpers/cr-sqlite";

test.beforeEach(async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
});

type SupplierTestFixture = {
	supplier: { id: number; name: string; email: string };
};
export type Supplier = {
	id?: number;
	name?: string;
	email?: string;
	address?: string;
};

export type SupplierOrder = {
	supplier_id: number;
	created: Date;
	lines: SupplierOrderLine[];
	id: number;
};
export type SupplierOrderLine = {
	supplier_id: number;
	supplier_name: string;
	isbn: string;
	title: string;
	authors: string;
	publisher: string;
	quantity: number;
	line_price: number;
};

const testOrders = test.extend<SupplierTestFixture>({
	supplier: async ({ page }, use) => {
		await page.goto(baseURL);

		const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com" };
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

testOrders("should create a new supplier order", async ({ page, supplier }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	page.getByRole("button", { name: "Unordered" });

	await page.getByRole("button", { name: "Place Order" }).first().click();

	await expect(page.getByText("1234")).toBeVisible();

	// price
	await expect(page.getByText("24")).toBeVisible();

	await expect(page.getByText("13")).toBeVisible();
	await expect(page.getByText("37")).toBeVisible();

	await page.getByRole("checkbox").first().click();

	await page.getByRole("checkbox").nth(1).click();

	await page.getByRole("button", { name: "Place Order" }).first().click();

	await page.waitForURL(`${baseURL}orders/suppliers/`);
	page.getByRole("button", { name: "Ordered" }).nth(1).click();
	await expect(page.getByText(supplier.name)).toBeVisible();
	await expect(page.getByText("reconcile")).toBeVisible();
});

testOrders("should show list of unordered orders", async ({ page, supplier }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	page.getByRole("button", { name: "Unordered" });

	await expect(page.getByText(supplier.name)).toBeVisible();
	await expect(page.getByText("2")).toBeVisible();
});
testOrders("should show a supplier order with the correct details", async ({ page, supplier }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(createSupplierOrder, [
		{
			supplier_id: supplier.id,
			supplier_name: supplier.name,
			isbn: "1234",
			line_price: 12,
			quantity: 1,
			title: "Book1",
			authors: "Author1"
		}
	]);

	await page.goto(`${baseURL}orders/suppliers/`);
	page.getByRole("button", { name: "Ordered" }).nth(1).click();

	const updateButton = page.getByRole("button", { name: "View Order" }).first();
	await updateButton.click();
	// await page.waitForURL(`${baseURL}orders/suppliers/1/`);

	// await expect(page.getByText(customer.fullname)).toBeVisible();
	// await expect(page.getByText(customer.email)).toBeVisible();

	await expect(page.getByText(supplier.name)).toBeVisible();
});
