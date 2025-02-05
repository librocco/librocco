import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDbHandle } from "@/helpers";
import { createSupplierOrder } from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";

test.beforeEach(async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
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
