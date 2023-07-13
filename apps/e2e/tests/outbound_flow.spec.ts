import { test } from "@playwright/test";

import { NoteState } from "@librocco/shared";

import { baseURL } from "./constants";

import { getDashboard } from "./helpers";
import { renameEntity, getNoteStatePicker } from "./utils";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	// Wait for the app to become responsive
	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the outbound note page
	await dashboard.navigate("outbound");
});

test('should create a new outbound note, on "Create note" button click and show it in the sidebar', async ({ page }) => {
	const dasbboard = getDashboard(page);
	const sidebar = dasbboard.sidebar();

	// Create a new note
	await sidebar.createNote();

	// Check that we've been redirected to the new note's page
	await dasbboard.content().heading("New Note").waitFor();

	// The sidebar should show only the created note at this point
	await sidebar.assertLinks(["New Note"]);
});

test("should allow for renaming of the note using the editable title and show the update in the sidebar", async ({ page }) => {
	const sidebar = getDashboard(page).sidebar();

	// Create a new note
	await sidebar.createNote();

	// Rename "New Note"
	await renameEntity(page, "Note 1");

	// The sidebar should display the updated note name
	await sidebar.assertLinks(["Note 1"]);
});

test("note heading should display note name, 'updated at' timestamp and note state", async ({ page }) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Create a new note
	await sidebar.createNote();

	// Check note page contents
	await content.heading("New Note").waitFor();

	// Check that the "Last updated: " timestamp is close to current date
	await content.assertUpdatedAt(new Date());

	// Should display "Draft" state
	await content.statePicker().assertState(NoteState.Draft);
});

test("should assign default name to notes in sequential order", async ({ page }) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Create a new note
	await sidebar.createNote();
	await content.heading("New Note").waitFor();

	// The note naming sequence continues from the highest numbered note
	await sidebar.createNote();
	await content.heading("New Note (2)").waitFor();
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Create three notes (we can use only "New Warehouse" for this)
	await sidebar.createNote();
	await sidebar.createNote();
	await sidebar.createNote();

	// Check the nav links before continuing
	await sidebar.assertLinks(["New Note", "New Note (2)", "New Note (3)"]);

	// Rename the first two notes
	await sidebar.link("New Note").click();
	await content.heading("New Note", { exact: true }).waitFor();
	await renameEntity(page, "Note 1");

	await sidebar.link("New Note (2)").click();
	await content.heading("New Note (2)").waitFor();
	await renameEntity(page, "Note 2");

	// Check the nav links for good measure
	await sidebar.assertLinks(["Note 1", "Note 2", "New Note (3)"]);

	// Creating a new note should continue off from "New Note (3)"
	await sidebar.createNote();

	await sidebar.assertLinks(["Note 1", "Note 2", "New Note (3)", "New Note (4)"]);
});

test("should reset the naming sequence when all notes with default names get renamed", async ({ page }) => {
	const view = getDashboard(page);

	const sidebar = view.sidebar();
	const content = view.content();

	// Create three notes (we can use only "New Warehouse" for this)
	await sidebar.createNote();
	await sidebar.createNote();
	await sidebar.createNote();

	// Rename all of the notes
	await sidebar.link("New Note").click();
	await content.heading("New Note", { exact: true }).waitFor();
	await renameEntity(page, "Note 1");

	await sidebar.link("New Note (2)").click();
	await content.heading("New Note (2)").waitFor();
	await renameEntity(page, "Note 2");

	await sidebar.link("New Note (3)").click();
	await content.heading("New Note (3)").waitFor();
	await renameEntity(page, "Note 3");

	// Check the nav links for good measure
	await sidebar.assertLinks(["Note 1", "Note 2", "Note 3"]);

	// Creating a new note should start over from "New Note"
	await sidebar.createNote();

	await sidebar.assertLinks(["Note 1", "Note 2", "Note 3", "New Note"]);
});

test("should remove the note from the sidebar when the note is deleted", async ({ page }) => {
	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	// Create two notes in the given warehouse
	await sidebar.createNote();
	await sidebar.createNote();

	// Check the links
	await sidebar.assertLinks(["New Note", "New Note (2)"]);

	// Delete the "New Note (2)" note (we're already at "New Note (2)" page)
	await content.statePicker().select(NoteState.Deleted);

	// Check that the note has been deleted from the sidebar
	await sidebar.assertLinks(["New Note"]);
});
