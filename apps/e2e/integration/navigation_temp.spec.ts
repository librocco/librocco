import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard } from "@/helpers";

test("should navigate using the side nav", async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Should load 'stock' page as default
	await page.getByRole("link", { name: "Search stock" }).click();
	await dashboard.content().header().title().assert("Search");

	// Navigate to 'inventory' page
	await page.getByRole("link", { name: "Manage inventory" }).click();
	await dashboard.content().header().title().assert("Inventory");

	// Navigate to 'outbound' page
	await page.getByRole("link", { name: "Outbound" }).click();
	await dashboard.content().header().title().assert("Outbound");

	// Navigate to 'settings' page
	await page.getByRole("link", { name: "Settings" }).click();
	await dashboard.content().header().title().assert("Settings");
});
