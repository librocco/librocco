import { expect } from "@playwright/test";

import { baseURL } from "./constants";
import { testOrders } from "@/helpers/fixtures";

// * Note: its helpful to make an assertion after each <enter> key
// as it seems that Playwright may start running assertions before page data has fully caught up

testOrders("should show correct delivery stats in commit view", async ({ page, books, placedOrderLines }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	firstRow.getByRole("cell", { name: placedOrderLines[0].isbn });

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Wait for the first row to be added
	await expect(table.getByText("1111111111").first()).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check the quantity is updated before...
	// TODO: more specific selectors for table cells?
	await expect(table.getByText("2").first()).toBeVisible();

	// ... moving to compare
	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(page.getByText("Total delivered:")).toBeVisible();

	await expect(table.getByText(books[0].isbn)).toBeVisible();

	await expect(table.getByText("1111111111")).toBeVisible();

	await page.waitForTimeout(1000);

	await expect(page.getByText("2 / 1")).toBeVisible();
});

testOrders("should correctly increment quantities when scanning same ISBN multiple times", async ({ page, books, placedOrderLines }) => {
	await page.goto(`${baseURL}orders/suppliers/orders/`);
	await page.getByText("Ordered").nth(1).click();
	await page.getByRole("checkbox").nth(1).click();
	await page.getByText("Reconcile").first().click();
	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	firstRow.getByRole("cell", { name: placedOrderLines[0].isbn });

	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Wait for the first row to be added
	await expect(table.getByText("1111111111")).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	const secondRow = table.getByRole("row").nth(2);

	await expect(firstRow.getByRole("cell", { name: "2" })).toBeVisible();

	console.log(books[0]);
	await isbnInput.fill(books[0].isbn);
	await page.keyboard.press("Enter");

	// Check new isbn row is visible
	await expect(table.getByText(books[0].isbn)).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check the 111111 row quantity is updated
	await expect(firstRow.getByRole("cell", { name: "1111111111" })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: "3" })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();

	await expect(secondRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});
