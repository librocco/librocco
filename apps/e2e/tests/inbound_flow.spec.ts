import { test } from "@playwright/test";

import { NoteState } from "@librocco/shared";

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
	const sidebar = getDashboard(page).sidebar();
	await sidebar.assertGroups(["All", "New Warehouse", "New Warehouse (2)"]);

	// Create a new inbound note in the first warehouse
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");
	await linkGroupWh1.createNote();

	// The new note link should be visible in the sidebar in both "All" and "New Warehouse" groups
	await sidebar.linkGroup("All").assertLinks(["New Note"]);
	await linkGroupWh1.assertLinks(["New Note"]);
	// The second warehouse has no notes and its link group should be empty
	await sidebar.linkGroup("New Warehouse (2)").assertLinks([]);
});

test("should allow for renaming of the note using the editable title and show the update in the sidebar", async ({ page }) => {
	const sidebar = getDashboard(page).sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	// Create a new note
	await linkGroupWh1.createNote();

	// Rename "New Note"
	await renameEntity(page, "Note 1");

	// The sidebar should display the updated note name in both "All" and "New Warehouse" groups
	await sidebar.linkGroup("All").assertLinks(["Note 1"]);
	await linkGroupWh1.assertLinks(["Note 1"]);
});

test("note heading should display note name, warehouse it belongs to and 'updated at' timestamp", async ({ page }) => {
	const dashboard = getDashboard(page);

	// Create a new note in the given warehouse
	await dashboard.sidebar().linkGroup("New Warehouse").createNote();

	// Check note page contents
	const content = dashboard.content();
	await content.heading("New Note").waitFor();

	// Check that the "Last updated: " timestamp is close to current date
	await content.assertUpdatedAt(new Date());

	// Should display "Draft" state
	await content.statePicker().assertState(NoteState.Draft);
});

test("should assign default name to note in sequential order", async ({ page }) => {
	const sidebar = getDashboard(page).sidebar();

	// Create two inbound notes, one in each warehouse
	await sidebar.linkGroup("New Warehouse").createNote();
	await sidebar.linkGroup("New Warehouse (2)").createNote();

	// Check the nav links
	await sidebar.linkGroup("All").assertLinks(["New Note", "New Note (2)"]);
	await sidebar.linkGroup("New Warehouse").assertLinks(["New Note"]);
	await sidebar.linkGroup("New Warehouse (2)").assertLinks(["New Note (2)"]);
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	const content = dashboard.content();

	// Create three notes (we can use only "New Warehouse" for this)
	await linkGroupWh1.createNote();
	await linkGroupWh1.createNote();
	await linkGroupWh1.createNote();

	// Check the nav links before continuing
	await linkGroupWh1.assertLinks(["New Note", "New Note (2)", "New Note (3)"]);

	// Rename the first two notes
	await linkGroupWh1.link("New Note").click();
	await content.heading("New Note in New Warehouse").waitFor();
	await renameEntity(page, "Note 1");

	await linkGroupWh1.link("New Note (2)").click();
	await content.heading("New Note (2)").waitFor();
	await renameEntity(page, "Note 2");

	// Check the nav links for good measure
	await linkGroupWh1.assertLinks(["Note 1", "Note 2", "New Note (3)"]);

	// Creating a new note should continue off from "New Note (3)"
	await linkGroupWh1.createNote();

	await sidebar.assertLinks(["Note 1", "Note 2", "New Note (3)", "New Note (4)"]);
});

test("should reset the naming sequence when all notes with default names get renamed", async ({ page }) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	const content = dashboard.content();

	// Create three notes (we can use only "New Warehouse" for this)
	await linkGroupWh1.createNote();
	await linkGroupWh1.createNote();
	await linkGroupWh1.createNote();

	// Rename all of the notes
	await linkGroupWh1.link("New Note").click();
	await content.heading("New Note in New Warehouse").waitFor();
	await renameEntity(page, "Note 1");

	await linkGroupWh1.link("New Note (2)").click();
	await content.heading("New Note (2)").waitFor();
	await renameEntity(page, "Note 2");

	await linkGroupWh1.link("New Note (3)").click();
	await content.heading("New Note (3)").waitFor();
	await renameEntity(page, "Note 3");

	// Wait for the last update to be shown in the sidebar
	await sidebar.link("Note 3").waitFor();

	// Check the nav links for good measure
	await linkGroupWh1.assertLinks(["Note 1", "Note 2", "Note 3"]);

	// Creating a new note should start over from "New Note"
	await linkGroupWh1.createNote();

	await sidebar.assertLinks(["Note 1", "Note 2", "Note 3", "New Note"]);
});

test("should remove the note from the sidebar when the note is deleted", async ({ page }) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	const content = dashboard.content();

	// Create two notes in the first warehouse
	await linkGroupWh1.createNote();
	await linkGroupWh1.createNote();

	// Check the links
	const linkGroupAll = sidebar.linkGroup("All");
	await linkGroupAll.assertLinks(["New Note", "New Note (2)"]);
	await linkGroupWh1.assertLinks(["New Note", "New Note (2)"]);

	// Delete the "New Note (2)" note (we're already at "New Note (2)" page)
	await content.statePicker().select(NoteState.Deleted);

	// Check that the note has been deleted from the sidebar
	await linkGroupAll.assertLinks(["New Note"]);
	await linkGroupWh1.assertLinks(["New Note"]);
});
