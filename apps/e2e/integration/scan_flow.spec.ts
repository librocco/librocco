import { expect, test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard, getDbHandle } from "../helpers";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// We're using outbound note view, but same behaviour should apply to inbound as well
	await dashboard.navigate("outbound");

	// DB Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);

	// Navigate to the test note
	await dashboard.sidebar().link("Note 1").click();
	await dashboard.content().heading("Note 1").waitFor();
});

test('should route "keyboard" input with freqency of scan input to the scan input element even if scan element is not focused', async ({
	page
}) => {
	await page.keyboard.type("1234567890");
	await page.keyboard.press("Enter");

	// The input should have been submitted and a new transaction added
	await getDashboard(page)
		.content()
		.entries("outbound")
		.assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test('should route "keyboard" input with freqency of scan input to the scan input element even if another input element is focused', async ({
	page
}) => {
	const content = getDashboard(page).content();

	// Open the editable heading and focus the input
	await content.heading("Note 1").click();
	await content.heading("Note 1").textInput().focus();

	// Typing with scanning frequency should route the input to the scan element
	await page.keyboard.type("1234567890");
	await page.keyboard.press("Enter");

	// The input should have been submitted and a new transaction added
	await getDashboard(page)
		.content()
		.entries("outbound")
		.assertRows([{ isbn: "1234567890", quantity: 1 }]);
});

test('should not route "keyboard" input with freqency of human input to the scan input element (unless scan input field is focused)', async ({
	page
}) => {
	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Open the editable heading and focus the input
	await content.heading("Note 1").click();
	await content.heading("Note 1").textInput().clear();
	await content.heading("Note 1").textInput().focus();

	// Typing with scanning frequency should route the input to the scan element
	await page.keyboard.type("Note 2", { delay: 100 });
	await page.keyboard.press("Enter");

	// The raname action should have taken place (as editable heading was focused)
	await content.heading("Note 2").waitFor();
	await dashboard.sidebar().assertLinks(["Note 2"]);

	// No new transaction should have been added
	await expect(getDashboard(page).content().entries("outbound")).not.toBeAttached();
});
