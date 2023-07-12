import { expect, test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard } from "./helpers";
import { createDefaultWarehouses, renameEntity, getNoteStatePicker } from "./utils";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	// Wait for the app to become responsive (when the default view is loaded)
	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Create two warehouses first (to which we can add the notes)
	await createDefaultWarehouses(page, 2);

	// Navigate to the inbound note page
	await dashboard.navigate("inbound");
});

test('should create a new inbound note, belonging to a particular warehouse on "Create note" button click', async ({ page }) => {
	// Check that the sidebar shows the "All" group as well as one group per each of the created warehouses
	const sidebar = getDashboard(page).view("inbound").sidebar();
	await sidebar.assertGroups(["All", "New Warehouse", "New Warehouse (2)"]);

	// Create a new inbound note in the first warehouse
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");
	await linkGroupWh1.createNote();

	// Check that we've been redirected to the new note's page
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	// The new note link should be visible in the sidebar in both "All" and "New Warehouse" groups
	await sidebar.linkGroup("All").assertLinks(["New Note"]);
	await linkGroupWh1.assertLinks(["New Note"]);
	// The second warehouse has no notes and its link group should be empty
	await sidebar.linkGroup("New Warehouse (2)").assertLinks([]);
});

test("should allow for renaming of the note using the editable title and show the update in the sidebar", async ({ page }) => {
	const sidebar = getDashboard(page).view("inbound").sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	// Create a new note
	await linkGroupWh1.createNote();

	// Check that we've been redirected to the new note's page
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	// Rename "New Note"
	await renameEntity(page, "Note 1");

	// The sidebar should display the updated note name in both "All" and "New Warehouse" groups
	await sidebar.linkGroup("All").assertLinks(["Note 1"]);
	await linkGroupWh1.assertLinks(["Note 1"]);
});

test("note heading should display note name, warehouse it belongs to and 'updated at' timestamp", async ({ page }) => {
	// Create a new note in the given warehouse
	await getDashboard(page).view("inbound").sidebar().linkGroup("New Warehouse").createNote();

	// Check note page contents
	await page.getByRole("heading", { name: "New Note in New Warehouse" }).waitFor();

	const updatedAtElement = page.getByText("Last updated:");
	await updatedAtElement.waitFor();
	const updatedAtString = await updatedAtElement.evaluate((element) => element.textContent);

	const updatedAt = new Date(
		updatedAtString
			// Replace the " at " separator (webkit formatted date) to a regular date string
			.replace(" at ", ", ")
			.replace("Last updated: ", "")
	);

	// Without mocking the date, we can't assert the exact date, but we can expect the updated at to be under a minute from now
	expect(Date.now() - 60 * 1000).toBeLessThan(updatedAt.getTime());

	// Should display "Draft" state
	await page.getByText("Draft").waitFor();
});

test("should assign default name to note in sequential order", async ({ page }) => {
	const sidebar = getDashboard(page).view("inbound").sidebar();

	// Create a new inbound note in the first warehouse
	await sidebar.linkGroup("New Warehouse").createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	// The note naming sequence continues from the highest numbered note of all the inbound notes (regardless of the warehouse)
	await sidebar.linkGroup("New Warehouse (2)").createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const sidebar = getDashboard(page).view("inbound").sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	// Create three notes (we can use only "New Warehouse" for this)
	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();

	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note (3)" }).waitFor();

	// Check the nav links before continuing
	await linkGroupWh1.assertLinks(["New Note", "New Note (2)", "New Note (3)"]);

	// Rename the first two notes
	await linkGroupWh1.link("New Note").click();
	await page.getByRole("heading", { name: "New Note in New Warehouse" }).waitFor();
	await renameEntity(page, "Note 1");

	await linkGroupWh1.link("New Note (2)").click();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();
	await renameEntity(page, "Note 2");

	// Check the nav links for good measure
	await linkGroupWh1.assertLinks(["Note 1", "Note 2", "New Note (3)"]);

	// Creating a new note should continue off from "New Note (3)"
	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note (4)" }).waitFor();
});

test("should reset the naming sequence when all notes with default names get renamed", async ({ page }) => {
	const sidebar = getDashboard(page).view("inbound").sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	// Create three notes (we can use only "New Warehouse" for this)
	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();

	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note (3)" }).waitFor();

	// Rename all of the notes
	await linkGroupWh1.link("New Note").click();
	await page.getByRole("heading", { name: "New Note in New Warehouse", exact: true }).waitFor();
	await renameEntity(page, "Note 1");

	await linkGroupWh1.link("New Note (2)").click();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();
	await renameEntity(page, "Note 2");

	await linkGroupWh1.link("New Note (3)").click();
	await page.getByRole("heading", { name: "New Note (3)" }).waitFor();
	await renameEntity(page, "Note 3");

	// Wait for the last update to be shown in the sidebar
	await sidebar.link("Note 3").waitFor();

	// Check the nav links for good measure
	await linkGroupWh1.assertLinks(["Note 1", "Note 2", "Note 3"]);

	// Creating a new note should start over from "New Note"
	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();
});

test("should remove the note from the sidebar when the note is deleted", async ({ page }) => {
	const sidebar = getDashboard(page).view("inbound").sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	// Create two notes in the given warehouse
	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	await linkGroupWh1.createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();

	// Check the links
	const linkGroupAll = sidebar.linkGroup("All");
	await linkGroupAll.assertLinks(["New Note", "New Note (2)"]);
	await linkGroupWh1.assertLinks(["New Note", "New Note (2)"]);

	// Delete the "New Note (2)" note (we're already at "New Note (2)" page)
	const noteStatePicker = getNoteStatePicker(page);
	await noteStatePicker.locator("button").click();
	await noteStatePicker.getByText("Delete", { exact: true }).click();

	// Check that the note has been deleted from the sidebar
	await linkGroupAll.assertLinks(["New Note"]);
	await linkGroupWh1.assertLinks(["New Note"]);
});
