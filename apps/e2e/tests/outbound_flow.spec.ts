import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";

import { getSidebar, renameEntity, getNoteStatePicker } from "./utils";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);
	// Wait for the app to become responsive (when the default view is loaded)
	await page.getByRole("heading", { name: "All" }).getByText("All").waitFor();

	// Navigate to the outbound note page
	await page.getByRole("link", { name: "Outbound" }).click();

	// Wait for the inbound page to load (assert this by "All" nav group being visible)
	await page.locator('[data-view="outbound"]').waitFor();
});

test('should create a new outbound note, on "Create note" button click and show it in the sidebar', async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create a new note
	await sidebar.createNote();

	// Check that we've been redirected to the new note's page
	await page.getByRole("heading", { name: "New Note" }).waitFor();
	// Wait for the note link to appear in the sidebar
	await sidebar.link("New Note").waitFor();

	// The sidebar should show only the created note at this point
	await sidebar.assertLinks(["New Note"]);
});

test("should allow for renaming of the note using the editable title and show the update in the sidebar", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create a new note
	await sidebar.createNote();

	// Check that we've been redirected to the new note's page
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	// Rename "New Note"
	await renameEntity(page, "Note 1");

	// Wait for the update to be shown in the sidebar
	await sidebar.link("Note 1").waitFor();

	// The sidebar should display the updated note name
	await sidebar.assertLinks(["Note 1"]);
});

test("note heading should display note name, 'updated at' timestamp and note state", async ({ page }) => {
	// Create a new note
	await getSidebar(page).createNote();

	// Check note page contents
	await page.getByRole("heading", { name: "New Note", exact: true }).waitFor();

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
	await getNoteStatePicker(page).getByText("Draft").waitFor();
});

test("should assign default name to notes in sequential order", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create a new note
	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	// The note naming sequence continues from the highest numbered note
	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const sidebar = getSidebar(page);

	// Create three notes (we can use only "New Warehouse" for this)
	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();

	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note (3)" }).waitFor();

	// Wait for the last note created to be shown in the sidebar
	await sidebar.link("New Note (3)").waitFor();

	// Check the nav links before continuing
	await sidebar.assertLinks(["New Note", "New Note (2)", "New Note (3)"]);

	// Rename the first two notes
	await sidebar.link("New Note").click();
	await page.getByRole("heading", { name: "New Note", exact: true }).waitFor();
	await renameEntity(page, "Note 1");

	await sidebar.link("New Note (2)").click();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();
	await renameEntity(page, "Note 2");

	// Wait for the navigation to show the latest update
	await sidebar.link("Note 2").waitFor();

	// Check the nav links for good measure
	await sidebar.assertLinks(["Note 1", "Note 2", "New Note (3)"]);

	// Creating a new note should continue off from "New Note (3)"
	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note (4)" }).waitFor();
});

test("should reset the naming sequence when all notes with default names get renamed", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create three notes (we can use only "New Warehouse" for this)
	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();

	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note (3)" }).waitFor();

	// Wait for the last note created to be shown in the sidebar
	await sidebar.link("New Note (3)").waitFor();

	// Rename all of the notes
	await sidebar.link("New Note").click();
	await page.getByRole("heading", { name: "New Note", exact: true }).waitFor();
	await renameEntity(page, "Note 1");

	await sidebar.link("New Note (2)").click();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();
	await renameEntity(page, "Note 2");

	await sidebar.link("New Note (3)").click();
	await page.getByRole("heading", { name: "New Note (3)" }).waitFor();
	await renameEntity(page, "Note 3");

	// Wait for the last update to appear in the sidebar
	await sidebar.link("Note 3").waitFor();

	// Check the nav links for good measure
	await sidebar.assertLinks(["Note 1", "Note 2", "Note 3"]);

	// Creating a new note should start over from "New Note"
	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	// The latest note should be shown in the sidebar
	await sidebar.link("New Note").waitFor();
	await sidebar.assertLinks(["Note 1", "Note 2", "Note 3", "New Note"]);
});

test("should remove the note from the sidebar when the note is deleted", async ({ page }) => {
	const sidebar = getSidebar(page);

	// Create two notes in the given warehouse
	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note" }).waitFor();

	await sidebar.createNote();
	await page.getByRole("heading", { name: "New Note (2)" }).waitFor();

	// Wait for the latest note to be shown in the sidebar
	await sidebar.link("New Note (2)").waitFor();

	// Check the links
	await sidebar.assertLinks(["New Note", "New Note (2)"]);

	// Delete the "New Note (2)" note (we're already at "New Note (2)" page)
	const noteStatePicker = getNoteStatePicker(page);
	await noteStatePicker.locator("button").click();
	await noteStatePicker.getByText("Delete", { exact: true }).click();

	// Wait for the deletion to be reflected in the sidebar
	await sidebar.link("New Note (2)").waitFor({ state: "detached" });

	// Check that the note has been deleted from the sidebar
	await sidebar.assertLinks(["New Note"]);
});
