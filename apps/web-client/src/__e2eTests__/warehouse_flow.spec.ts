import { test } from "@playwright/test";

import { createDefaultWarehouses, getSidebar, renameEntity } from "./utils";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto("http://localhost:5173");
	// Wait for the app to become responsive (when the default view is loaded)
	await page.getByRole("heading", { name: "All" }).getByText("All").waitFor();
});

test("should create a warehouse on 'Create warehouse' button click and show that warehouse in the sidebar nav", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create the new warehouse by clicking the "Create warehouse" button
	await sidebar.createWarehouse();
	// Wait for the redirect to the new warehouse's page (when the "New Warehouse" heading appears, the redirect is complete)
	await page.getByRole("heading", { name: "New Warehouse" }).waitFor();
	// Wait for "New Warehouse" link to appear in the sidebar
	await sidebar.link("New Warehouse").waitFor();

	// Sidebar should display the "All" pseudo-warehouse and the newly created warehouse ("New Warehouse")
	await sidebar.assertLinks(["All", "New Warehouse"]);
});

test("should allow for renaming of the warehouse using the editable title and show the update in the sidebar", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create the new warehouse by clicking the "Create warehouse" button
	await sidebar.createWarehouse();
	// Wait for the redirect to the new warehouse's page (when the "New Warehouse" heading appears, the redirect is complete)
	await page.getByRole("heading", { name: "New Warehouse" }).waitFor();
	// Wait for "New Warehouse" link to appear in the sidebar
	await sidebar.link("New Warehouse").waitFor();

	// Rename "New Warehouse"
	//
	// Click the editable title
	await page.locator("#table-section").getByRole("heading").click();

	// Wait for the TextEditable to become an input
	const input = page.locator("#table-section").getByRole("heading").getByRole("textbox");
	await input.waitFor();

	// Fill in the new name and submit
	await input.clear();
	await input.fill("Warehouse 1");
	await input.press("Enter");

	// Wait for the navigation to show the update (signaling the update made the async round trip)
	await sidebar.link("Warehouse 1").waitFor();

	// The sidebar should display the default ("All") pseudo-warehouse and the renamed warehouse ("Warehouse 1")
	await sidebar.assertLinks(["All", "Warehouse 1"]);
});

test("should assign default warehouse names (with sequenced index) to newly created warehouses", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create 3 new warehouses by clicking on the 'Create warehouse' button
	await createDefaultWarehouses(page, 3);
	// Just in case, wait for the last warehouse to be added to the side nav
	await sidebar.link("New Warehouse (3)").waitFor();

	// We can check the naming sequence by looking at the sidebar nav
	await sidebar.assertLinks(["All", "New Warehouse", "New Warehouse (2)", "New Warehouse (3)"]);
});

test('should continue the sequenced order from the highest numbered "New Warehouse" even if lower numbered warehouses have been renamed', async ({
	page
}) => {
	const sidebar = getSidebar(page);

	// Create three warehouses with default naming ("New Warehouse", "New Warehouse (2)", "New Warehouse (3)")
	await createDefaultWarehouses(page, 3);
	// Just in case, wait for the last warehouse to be added to the side nav
	await sidebar.link("New Warehouse (3)").waitFor();

	// The sidebar nav should display the default ("All") pseudo-warehouse and the three newly created warehouses
	await sidebar.assertLinks(["All", "New Warehouse", "New Warehouse (2)", "New Warehouse (3)"]);

	// Rename the first two warehouses
	await sidebar.link("New Warehouse").click();
	await page.getByRole("heading", { name: "New Warehouse" }).waitFor();
	await renameEntity(page, "Warehouse 1");

	await sidebar.link("New Warehouse (2)").click();
	await page.getByRole("heading", { name: "New Warehouse (2)" }).waitFor();
	await renameEntity(page, "Warehouse 2");

	// Wait for the last update to appear in the sidebar
	await sidebar.link("Warehouse 2").waitFor();

	// The sidebar nav should display the updated warehouse names
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "New Warehouse (3)"]);

	// Create a new warehouse
	await sidebar.createWarehouse();

	// When naming a new warehouse, the naming sequence picks up after (existing) "New Warehouse (3)"
	await page.getByRole("heading", { name: "New Warehouse (4)" }).waitFor();
	// Wait for the newly created warehouse to appear in the sidebar
	await sidebar.link("New Warehouse (4)").waitFor();

	// Check the nav links for good measure
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "New Warehouse (3)", "New Warehouse (4)"]);
});

test("should reset the naming sequence when all warehouses with default names get renamed", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create three warehouses with default naming ("New Warehouse", "New Warehouse (2)", "New Warehouse (3)")
	await createDefaultWarehouses(page, 3);
	// Wait for the last warehouse to be added to the side nav
	await sidebar.link("New Warehouse (3)").waitFor();

	// The sidebar nav should display the default ("All") pseudo-warehouse and the three newly created warehouses
	await sidebar.assertLinks(["All", "New Warehouse", "New Warehouse (2)", "New Warehouse (3)"]);

	// Rename all of the warehouses (restarting the naming sequence)
	await sidebar.link("New Warehouse").click();
	await page.getByRole("heading", { name: "New Warehouse" }).waitFor();
	await renameEntity(page, "Warehouse 1");

	await sidebar.link("New Warehouse (2)").click();
	await page.getByRole("heading", { name: "New Warehouse (2)" }).waitFor();
	await renameEntity(page, "Warehouse 2");

	await sidebar.link("New Warehouse (3)").click();
	await page.getByRole("heading", { name: "New Warehouse (3)" }).waitFor();
	await renameEntity(page, "Warehouse 3");

	// Wait for the last update to appear in the sidebar
	await sidebar.link("Warehouse 3").waitFor();

	// The sidebar nav should display the updated warehouse names
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "Warehouse 3"]);

	// Create a new warehouse
	await sidebar.createWarehouse();

	// The new warehouse should now have the default name ("New Warehouse")
	await page.getByRole("heading", { name: "New Warehouse", exact: true }).waitFor();
	// Wait for the newly created warehouse to appear in the sidebar
	await sidebar.link("New Warehouse").waitFor();

	// Check the nav links for good measure
	//
	// "New Warehouse" appears last as nav items are sorted in chronological order (under the hood, using timestamped ids)
	await sidebar.assertLinks(["All", "Warehouse 1", "Warehouse 2", "Warehouse 3", "New Warehouse"]);
});
