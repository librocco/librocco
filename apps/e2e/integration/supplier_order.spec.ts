import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDbHandle } from "@/helpers";
import { addBooksToCustomer, associatePublisher, createSupplierOrder } from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";

testOrders.beforeEach(async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
});
testOrders("should show empty state when no customer orders exist", async ({ page }) => {
	await expect(page.getByRole("table")).not.toBeVisible();
	await expect(page.getByText("No supplier orders available")).toBeVisible();

	const createOrderButton = page.getByRole("button", { name: "New Customer Order" });
	await expect(createOrderButton).toBeVisible();

	await createOrderButton.click();

	await expect(page.getByRole("dialog")).toBeVisible();
});
testOrders("should show list of unordered orders", async ({ page, supplier, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });
	await dbHandle.evaluate(associatePublisher, { supplierId: supplier.id, publisherId: "pub1" });

	await page.goto(`${baseURL}orders/suppliers/orders/`);
	page.getByRole("button", { name: "Unordered" });

	await expect(page.getByText(supplier.name)).toBeVisible();
	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(2);
	await expect(firstRow.getByRole("cell", { name: supplier.name })).toBeVisible();
	// assert for quantity cell with a value of "1"
	await expect(firstRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});
testOrders(
	"should allow a new supplier order to be placed from a batch of possible customer order lines",
	async ({ page, supplier, books, customer }) => {
		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(associatePublisher, { supplierId: supplier.id, publisherId: "pub1" });

		await dbHandle.evaluate(addBooksToCustomer, {
			customerId: customer.id,
			bookIsbns: [books[0].isbn, books[0].isbn]
		});
		await dbHandle.evaluate(addBooksToCustomer, {
			customerId: customer.id,
			bookIsbns: [books[2].isbn, books[2].isbn]
		});

		await page.goto(`${baseURL}orders/suppliers/orders/`);
		page.getByRole("button", { name: "Unordered" });

		await page.getByRole("button", { name: "Place Order" }).first().click();

		await expect(page.getByText(books[0].isbn)).toBeVisible();
		//total book count
		await expect(page.getByText("4", { exact: true })).toBeVisible();
		//total price
		await expect(page.getByText("80")).toBeVisible();

		const table = page.getByRole("table");
		const firstRow = table.getByRole("row").nth(1);
		await expect(firstRow.getByRole("cell", { name: "€" })).toHaveText("€20");
		await expect(page.getByRole("button", { name: "Place Order" }).first()).toBeHidden();

		await page.getByRole("checkbox").nth(1).click();

		//total book count
		await expect(page.getByText("2", { exact: true }).nth(1)).toBeVisible();
		//total price
		await expect(page.getByText("20")).toHaveCount(2);

		await page.getByRole("checkbox").nth(2).click();

		//total book count
		await expect(page.getByText("4", { exact: true })).toBeVisible();
		//total price
		await expect(page.getByText("80")).toHaveCount(2);

		//select 1/2
		await page.getByRole("button", { name: "Select 1/2" }).click();

		//total book count
		await expect(page.getByText("1", { exact: true })).toBeVisible();
		//total price
		await expect(page.getByText("20")).toHaveCount(2);

		await page.getByRole("button", { name: "Place Order" }).first().click();

		await page.waitForURL(`${baseURL}orders/suppliers/orders/`);
		page.getByRole("button", { name: "Ordered" }).nth(1).click();

		await expect(page.getByText(supplier.name)).toBeVisible();
		await expect(page.getByText("reconcile")).toBeVisible();

		await page.goto(`${baseURL}orders/suppliers/orders/`);
		page.getByRole("button", { name: "Unordered" });
		await page.getByRole("button", { name: "Place Order" }).first().click();

		await expect(page.getByText(books[2].isbn)).toBeVisible();
		//total book count
		await expect(page.getByText("2", { exact: true })).toHaveCount(2);
		//total price
		await expect(page.getByText("60")).toHaveCount(2);
	}
);

testOrders("should show a placed supplier order with the correct details", async ({ page, supplier, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(createSupplierOrder, [
		{
			supplier_id: supplier.id,
			supplier_name: supplier.name,
			isbn: books[0].isbn,
			line_price: books[0].price,
			quantity: 1,
			title: books[0].title,
			authors: books[0].authors
		}
	]);

	await page.goto(`${baseURL}orders/suppliers/orders/`);
	page.getByRole("button", { name: "Ordered" }).nth(1).click();

	const updateButton = page.getByRole("button", { name: "View Order" }).first();
	await updateButton.click();

	await expect(page.getByText(supplier.name)).toBeVisible();
	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	await expect(firstRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].authors })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].title })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: `${books[0].price}` })).toBeVisible();
});
