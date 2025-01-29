import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard } from "@/helpers";

test("should navigate using the side nav", async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Should load 'stock' page as default
	await dashboard.view("stock").waitFor();
	await dashboard.content().header().title().assert("Search");

	// Navigate to 'inventory' page
	await dashboard.navigate("inventory");
	await dashboard.content().header().title().assert("Inventory");

	// Navigate to 'outbound' page
	await dashboard.navigate("outbound");
	await dashboard.content().header().title().assert("Outbound");

	// Navigate to 'settings' page
	await dashboard.navigate("settings");
	await dashboard.content().header().title().assert("Settings");
});
