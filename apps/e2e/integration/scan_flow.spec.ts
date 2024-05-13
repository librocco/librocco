import { test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard } from "@/helpers";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// We're using outbound note view, but same behaviour should apply to inbound as well
	await dashboard.navigate("outbound");
	await dashboard.content().entityList("outbound-list").waitFor();

	// Create new outbound note (and navigate to it)
	await dashboard.content().header().createNote();
	await dashboard.content().header().title().assert("New Note");
});

test("should allow for continous scanning by auto focusing the scan field after the previous scanning operation is submitted", async ({
	page
}) => {
	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// The scan field needs to be focused before we can scan
	await content.scanField().focus();

	await page.keyboard.type("1234567890");
	await page.keyboard.press("Enter");

	// The input should have been submitted and a new transaction added
	await content.table("outbound-note").assertRows([{ isbn: "1234567890", quantity: 1 }]);

	// Add next book
	await page.keyboard.type("1234567891");
	await page.keyboard.press("Enter");

	await content.table("outbound-note").assertRows([
		{ isbn: "1234567890", quantity: 1 },
		{ isbn: "1234567891", quantity: 1 }
	]);
});
