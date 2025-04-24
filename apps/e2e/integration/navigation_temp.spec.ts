import { test, expect } from "@playwright/test";

import { baseURL } from "@/constants";

import { getDashboard } from "@/helpers";

test("should navigate using the side nav", async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Should load 'stock' page as default
	await page.getByRole("link", { name: "Search stock" }).click();
	await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "Search" })).toBeVisible();

	// Navigate to 'inventory' page
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "Warehouses" })).toBeVisible();

	// Navigate to 'outbound' page
	await page.getByRole("link", { name: "Outbound" }).click();
	await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "Outbound" })).toBeVisible();

	// Navigate to 'settings' page
	await page.getByRole("link", { name: "Settings" }).click();
	await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});
