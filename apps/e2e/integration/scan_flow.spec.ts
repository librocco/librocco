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

test('should route "keyboard" input with freqency of scan input to the scan input element even if scan element is not focused (by default)', async ({
	page
}) => {
	await page.keyboard.type("1234567890");
	await page.keyboard.press("Enter");

	// The input should have been submitted and a new transaction added
	await getDashboard(page)
		.content()
		.table("outbound-note")
		.assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test("should update scan input autofocus behaviour with respect to the state in store (toggle on 'scan' button click)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	// Turn the scan autofocus off
	await dashboard.content().scanField().toggleOff();

	// Attempt scan
	await page.keyboard.type("1234567890");
	await page.keyboard.press("Enter");

	// Nothing should have happened
	await getDashboard(page).content().table("outbound-note").assertRows([]);

	// Turn the scan autofocus back on and scan again
	await dashboard.content().scanField().toggleOn();
	await page.keyboard.type("1234567890");
	await page.keyboard.press("Enter");

	// The input should have been submitted and a new transaction added
	await getDashboard(page)
		.content()
		.table("outbound-note")
		.assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test('should route "keyboard" input with freqency of scan input to the scan input element even if another input element is focused', async ({
	page
}) => {
	const content = getDashboard(page).content();

	// Add one transaction (we'll need a quantity field)
	await content.scanField().add("1234567890");

	// Edit the quantity of the first transaction
	await content.table("outbound-note").row(0).getByRole("spinbutton").click();

	// Typing with scanning frequency should route the input to the scan element
	await page.keyboard.type("1234567891");
	await page.keyboard.press("Enter");

	// The input should have been submitted and a new transaction added
	await getDashboard(page)
		.content()
		.table("outbound-note")
		.assertRows([
			{ isbn: "1234567890", quantity: 1 },
			{ isbn: "1234567891", quantity: 1 }
		]);
});

test('should not route "keyboard" input with freqency of human input to the scan input element (unless scan input field is focused)', async ({
	page
}) => {
	const content = getDashboard(page).content();

	// Add one transaction (we'll need a quantity field)
	await content.scanField().add("1234567890");

	// Edit the quantity of the first transaction
	await content.table("outbound-note").row(0).getByRole("spinbutton").click();

	// Typing with frequency of human input should not route the input to the scan element
	// (instead quantity should be updated)
	await page.keyboard.type("44", { delay: 100 });
	await page.keyboard.press("Enter");

	// The input should have been submitted and a new transaction added
	await getDashboard(page)
		.content()
		.table("outbound-note")
		.assertRows([{ isbn: "1234567890", quantity: 144 }]);
});
