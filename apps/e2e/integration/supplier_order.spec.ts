import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDbHandle } from "@/helpers";
import { addBooksToCustomer, createSupplierOrder } from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";

test.beforeEach(async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
});

testOrders("should create a new supplier order", async ({ page, supplier, books }) => {
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn] });
	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });
	await page.goto(`${baseURL}orders/suppliers/`);
	page.getByRole("button", { name: "Unordered" });

	await page.getByRole("button", { name: "Place Order" }).first().click();

	await expect(page.getByText(books[0].isbn)).toBeVisible();

	// price

	await expect(page.getByRole("cell", { name: "€" })).toHaveText("€20");

	await page.getByRole("checkbox").first().click();

	await page.getByRole("checkbox").nth(1).click();

	await page.getByRole("button", { name: "Place Order" }).first().click();

	await page.waitForURL(`${baseURL}orders/suppliers/`);
	page.getByRole("button", { name: "Ordered" }).nth(1).click();
	await expect(page.getByText(supplier.name)).toBeVisible();
	await expect(page.getByText("reconcile")).toBeVisible();
});

testOrders("should show list of unordered orders", async ({ page, supplier, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });

	await page.goto(`${baseURL}orders/suppliers/`);
	page.getByRole("button", { name: "Unordered" });

	await expect(page.getByText(supplier.name)).toBeVisible();
	await expect(page.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});
testOrders("should show a supplier order with the correct details", async ({ page, supplier, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(createSupplierOrder, [
		{
			supplier_id: supplier.id,
			supplier_name: supplier.name,
			isbn: books[0].isbn,
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

	await expect(page.getByText(supplier.name)).toBeVisible();
});
