import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard } from "@/helpers/proto";

test("should navigate using the side nav", async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Should load 'stock' page as default
	await dashboard.view("search").waitFor();
	await dashboard.content().heading("Stock").waitFor();

	// Navigate to 'inventory' page
	await dashboard.navigate("inventory");
	await dashboard.content().heading("Inventory").waitFor();

	// Navigate to 'outbound' page
	await dashboard.navigate("outbound");
	await dashboard.content().heading("Outbound").waitFor();

	// Navigate to 'settings' page
	await dashboard.navigate("settings");
	await dashboard.content().heading("Settings").waitFor();
});
