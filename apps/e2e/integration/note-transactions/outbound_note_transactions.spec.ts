import { type Page, test } from "@playwright/test";

import { baseURL } from "../../constants";

import { getDashboard } from "../../helpers";

import { runCommonTransactionTests } from "./shared_tests";

const createNote = async (page: Page) => getDashboard(page).sidebar().createNote();

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// Navigate to the outbound view
	await dashboard.navigate("outbound");

	// Create a new note to work with
	await createNote(page);
});

runCommonTransactionTests("outbound");
