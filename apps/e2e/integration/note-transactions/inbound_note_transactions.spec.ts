import { type Page, test } from "@playwright/test";

import { baseURL } from "../../constants";

import { getDashboard } from "../../helpers";

import { runCommonTransactionTests } from "./shared_tests";

const createNote = async (page: Page) =>
	// For all inbound note tests (in this suite) we're using a first warehouse created
	// ("New Warehouse") to create notes
	getDashboard(page).sidebar().linkGroup("New Warehouse").createNote();

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	const sidebar = dashboard.sidebar();

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// Create a warehouse first to which we can add the notes
	await sidebar.createWarehouse();

	// Navigate to the inbound
	await dashboard.navigate("inbound");

	// Create a new note to work with
	await createNote(page);
});

runCommonTransactionTests("inbound");
