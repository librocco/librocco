import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard } from "./helpers";
import { createDefaultWarehouses, renameEntity } from "./utils";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);
	// Wait for the app to become responsive
	await getDashboard(page).waitFor();
});

test("should create a warehouse on 'Create warehouse' button click and show that warehouse in the sidebar nav", async ({ page }) => {
	const dashboard = getDashboard(page);
	const sidebar = dashboard.sidebar();

	// Create the new warehouse by clicking the "Create warehouse" button
	await sidebar.createWarehouse();

	// Wait for the redirect to the new warehouse's page (when the "New Warehouse" heading appears, the redirect is complete)
	await dashboard.content().heading("New Warehouse").waitFor();

	// Sidebar should display the "All" pseudo-warehouse and the newly created warehouse ("New Warehouse")
	await sidebar.assertLinks(["All", "New Warehouse"]);
});

test("should allow for renaming of the warehouse using the editable title and show the update in the sidebar", async ({ page }) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Create the new warehouse by clicking the "Create warehouse" button
	await sidebar.createWarehouse();
	// Wait for the redirect to the new warehouse's page (when the "New Warehouse" heading appears, the redirect is complete)
	await content.heading("New Warehouse").waitFor();

	// Rename "New Warehouse"
	//
	// Click the editable title
	await content.heading("New Warehouse", { exact: true }).container.click();

	// Wait for the TextEditable to become an input
	const input = content.container.getByRole("heading").getByRole("textbox");
	await input.waitFor();

	// Fill in the new name and submit
	await input.clear();
	await input.fill("Warehouse 1");
	await input.press("Enter");

	// The sidebar should display the default ("All") pseudo-warehouse and the renamed warehouse ("Warehouse 1")
	await sidebar.assertLinks(["All", "Warehouse 1"]);
});

test("should assign default warehouse names (with sequenced index) to newly created warehouses", async ({ page }) => {
	// Create 3 new warehouses by clicking on the 'Create warehouse' button
	await createDefaultWarehouses(page, 3);

	// We can check the naming sequence by looking at the sidebar nav
	await getDashboard(page).sidebar().assertLinks(["All", "New Warehouse", "New Warehouse (2)", "New Warehouse (3)"]);
});

test('should continue the sequenced order from the highest numbered "New Warehouse" even if lower numbered warehouses have been renamed', async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Create three warehouses with default naming ("New Warehouse", "New Warehouse (2)", "New Warehouse (3)")
	await createDefaultWarehouses(page, 3);

	// The sidebar nav should display the default ("All") pseudo-warehouse and the three newly created warehouses
	await sidebar.assertLinks(["All", "New Warehouse", "New Warehouse (2)", "New Warehouse (3)"]);

	// Rename the first two warehouses
	await sidebar.link("New Warehouse").click();
	await content.heading("New Warehouse", { exact: true }).waitFor();
	await renameEntity(page, "Warehouse 1");

	await sidebar.link("New Warehouse (2)").click();
	await content.heading("New Warehouse (2)").waitFor();
	await renameEntity(page, "Warehouse 2");

	// The sidebar nav should display the updated warehouse names
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "New Warehouse (3)"]);

	// Create a new warehouse
	await sidebar.createWarehouse();

	// When naming a new warehouse, the naming sequence picks up after (existing) "New Warehouse (3)"
	await content.heading("New Warehouse (4)").waitFor();

	// Check the nav links
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "New Warehouse (3)", "New Warehouse (4)"]);
});

test("should reset the naming sequence when all warehouses with default names get renamed", async ({ page }) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Create three warehouses with default naming ("New Warehouse", "New Warehouse (2)", "New Warehouse (3)")
	await createDefaultWarehouses(page, 3);

	// The sidebar nav should display the default ("All") pseudo-warehouse and the three newly created warehouses
	await sidebar.assertLinks(["All", "New Warehouse", "New Warehouse (2)", "New Warehouse (3)"]);

	// Rename all of the warehouses (restarting the naming sequence)
	await sidebar.link("New Warehouse").click();
	await content.heading("New Warehouse", { exact: true }).waitFor();
	await renameEntity(page, "Warehouse 1");

	await sidebar.link("New Warehouse (2)").click();
	await content.heading("New Warehouse (2)").waitFor();
	await renameEntity(page, "Warehouse 2");

	await sidebar.link("New Warehouse (3)").click();
	await content.heading("New Warehouse (3)").waitFor();
	await renameEntity(page, "Warehouse 3");

	// The sidebar nav should display the updated warehouse names
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "Warehouse 3"]);

	// Create a new warehouse
	await sidebar.createWarehouse();

	// The new warehouse should now have the default name ("New Warehouse")
	await content.heading("New Warehouse", { exact: true }).waitFor();

	// "New Warehouse" appears last as nav items are sorted in chronological order (under the hood, using timestamped ids)
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "Warehouse 3", "New Warehouse"]);
});
