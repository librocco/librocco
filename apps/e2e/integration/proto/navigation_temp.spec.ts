import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard } from "@/helpers/proto";

test("should navigate using the side nav", async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Should load 'stock' page as default
	await page.getByRole("heading").getByText("Stock").waitFor();

	// Navigate to 'inventory' page
	await dashboard.navigate("inventory");
	await page.getByRole("heading").getByText("Inventory").waitFor();

	// Navigate to 'outbound' page
	await dashboard.navigate("outbound");
	await page.getByRole("heading").getByText("Outbound").waitFor();

	// Navigate to 'settings' page
	await dashboard.navigate("settings");
	await page.getByRole("heading").getByText("Settings").waitFor();
});
