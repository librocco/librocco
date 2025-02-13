import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";

test.beforeEach(async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/orders`);

	await page.getByLabel("CreateReconciliationOrder").waitFor();
	page.getByLabel("CreateReconciliationOrder").click();
	await expect(page.getByLabel("CreateReconciliationOrder")).toBeDisabled();

	await page.reload();
	await page.getByText("Ordered").nth(1).click();

	await page.getByRole("checkbox").nth(1).click();

	await page.getByText("Reconcile").first().click();

	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
});

// * Note: its helpful to make an assertion after each <enter> key
// as it seems that Playwright may start running assertions before page data has fully caught up

test("should show correct delivery stats in commit view", async ({ page }) => {
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	const table = page.getByRole("table");

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

	await expect(table.getByText("123456789")).toBeVisible();
	await expect(table.getByText("1111111111")).toBeVisible();

	await page.waitForTimeout(1000);

	await expect(page.getByText("2 / 1")).toBeVisible();
});

test("should correctly increment quantities when scanning same ISBN multiple times", async ({ page }) => {
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	const table = page.getByRole("table");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Wait for the first row to be added
	await expect(table.getByText("1111111111")).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check the quantity is updated
	// TODO: more specific selectors for table cells?
	await expect(table.getByText("2")).toBeVisible();

	await isbnInput.fill("2222222222");
	await page.keyboard.press("Enter");

	// Check new isbn row is visible
	await expect(table.getByText("2222222222")).toBeVisible();

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	// Check the 111111 row quantity is updated
	await expect(table.getByText("3")).toBeVisible();
	await expect(table.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});
