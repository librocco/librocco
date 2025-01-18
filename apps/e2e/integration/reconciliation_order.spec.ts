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

	await page.reload();
	await page.getByText("Ordered").nth(1).click();

	await page.getByRole("checkbox").nth(1).click();

	await page.getByText("Reconcile").first().click();

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

	await page.getByRole("button", { name: "Compare" }).first().click();

	await expect(page.getByText("Total delivered:")).toBeVisible();

	await expect(table.getByText("123456789")).toBeVisible();
	await expect(table.getByText("1111111111")).toBeVisible();

	await expect(page.getByText("2 / 1")).toBeVisible();
});

test("should correctly increment quantities when scanning same ISBN multiple times", async ({ page }) => {
	const isbnInput = page.getByPlaceholder("Enter ISBN of delivered books");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	const table = page.getByRole("table");

	await expect(table.getByText("1111111111")).toBeVisible();
	await expect(table.getByText("2")).toBeVisible();

	await isbnInput.fill("2222222222");
	await page.keyboard.press("Enter");

	await isbnInput.fill("1111111111");
	await page.keyboard.press("Enter");

	await expect(table.getByText("1111111111")).toBeVisible();
	await expect(table.getByText("3")).toBeVisible();
	await expect(table.getByText("2222222222")).toBeVisible();
	await expect(table.getByRole("cell", { name: "1", exact: true })).toBeVisible();
});
