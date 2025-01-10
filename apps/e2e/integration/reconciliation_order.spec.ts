import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
test.beforeEach(async ({ page }) => {
	await page.goto(baseURL);
	page.getByLabel("Main navigation");
	page.getByRole("listitem").last().click();
	const nav = page.getByLabel("Main navigation");
	await nav.waitFor();
	await page.getByLabel("CreateReconciliationOrder").waitFor();
	page.getByLabel("CreateReconciliationOrder").click();
	await expect(page.getByLabel("CreateReconciliationOrder")).toBeDisabled();

	await page.goto(`${baseURL}orders/suppliers/reconcile/1`);

	await expect(page.getByText("Reconcile Deliveries")).toBeVisible();
});

test("should show correct delivery stats in commit view", async ({ page }) => {
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");
	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");
	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");
	await expect(table.getByText("1111111111").first()).toBeVisible();
	await expect(table.getByText("1111111111").nth(1)).toBeVisible();

	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(page.getByText("Total delivered:")).toBeVisible();

	await expect(table.getByText("123456789")).toBeVisible();
	await expect(table.getByText("1111111111")).toBeVisible();

	// Should show correct delivery stats
	await expect(page.getByText("2 / 1")).toBeVisible();
});
