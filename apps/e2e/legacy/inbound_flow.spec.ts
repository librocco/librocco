import { test } from "@playwright/test";

import { NoteState } from "@librocco/shared";
import { versionId } from "@librocco/db";

import { baseURL } from "../constants";

import { getDashboard, getDbHandle } from "@/helpers/legacy";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);

	// Wait for the app to become responsive (when the default view is loaded)
	await dashboard.waitFor();

	// Navigate to the inbound note page
	await dashboard.navigate("inbound");
});

test('should create a new inbound note, belonging to a particular warehouse on "Create note" button click', async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Display name should default to "New Warehouse"
		await db.warehouse("wh-1").create();
		// Display name should default to "New Warehouse (2)"
		await db.warehouse("wh-2").create();
	});

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
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) => db.warehouse("wh-1").create());

	const dashboard = getDashboard(page);

	const sidebar = dashboard.sidebar();
	const content = dashboard.content();

	const linkGroupWh1 = sidebar.linkGroup("New Warehouse");

	// Create a new note
	await linkGroupWh1.createNote();

	// Rename "New Note"
	await content.heading().rename("Note 1");

	// The sidebar should display the updated note name in both "All" and "New Warehouse" groups
	await sidebar.linkGroup("All").assertLinks(["Note 1"]);
	await linkGroupWh1.assertLinks(["Note 1"]);
});

test("note heading should display note name, warehouse it belongs to and 'updated at' timestamp", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => db.warehouse("test-warehouse").setName({}, "Test Warehouse"));

	const dashboard = getDashboard(page);

	// Create a new note in the given warehouse
	await dashboard.sidebar().linkGroup("Test Warehouse").createNote();

	// Check note page contents
	const content = dashboard.content();
	await content.heading("New Note").waitFor();

	// Check that the "Last updated: " timestamp is close to current date
	// (should be way less than 2 minute difference, but due to the date rounding down, we allow a bit of a buffer)
	await content.assertUpdatedAt(new Date(), { precision: 2 * 60 * 1000 });

	// Should display "Draft" state
	await content.statePicker().assertState(NoteState.Draft);
});

test("should assign default name to note in sequential order", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Display name should default to "New Warehouse"
		await db.warehouse("wh-1").create();
		// Display name should default to "New Warehouse (2)"
		await db.warehouse("wh-2").create();
	});

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
	// Setup
	const dbHandle = await getDbHandle(page);
	// Display name should default to "New Warehouse"
	await dbHandle.evaluate(async (db) => db.warehouse("wh-1").create());

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
	await content.heading().rename("Note 1");

	await linkGroupWh1.link("New Note (2)").click();
	await content.heading("New Note (2)").waitFor();
	await content.heading().rename("Note 2");

	// Check the nav links for good measure
	await linkGroupWh1.assertLinks(["Note 1", "Note 2", "New Note (3)"]);

	// Creating a new note should continue off from "New Note (3)"
	await linkGroupWh1.createNote();

	await sidebar.assertLinks(["Note 1", "Note 2", "New Note (3)", "New Note (4)"]);
});

test("should reset the naming sequence when all notes with default names get renamed", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	// Display name defaults to "New Warehouse"
	await dbHandle.evaluate((db) => db.warehouse("wh-1").create());

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
	await content.heading().rename("Note 1");

	await linkGroupWh1.link("New Note (2)").click();
	await content.heading("New Note (2)").waitFor();
	await content.heading().rename("Note 2");

	await linkGroupWh1.link("New Note (3)").click();
	await content.heading("New Note (3)").waitFor();
	await content.heading().rename("Note 3");

	// Wait for the last update to be shown in the sidebar
	await sidebar.link("Note 3").waitFor();

	// Check the nav links for good measure
	await linkGroupWh1.assertLinks(["Note 1", "Note 2", "Note 3"]);

	// Creating a new note should start over from "New Note"
	await linkGroupWh1.createNote();

	await sidebar.assertLinks(["Note 1", "Note 2", "Note 3", "New Note"]);
});

test("should remove the note from the sidebar when the note is deleted", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	// Display name defaults to "New Warehouse"
	await dbHandle.evaluate((db) => db.warehouse("wh-1").create());

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

// TODO: Unskip when working on https://github.com/librocco/librocco/issues/347
test.skip("should automatically open the warehouse group the note belongs to on page load", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			// Create a warehouse to work with
			.warehouse("wh-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
			// Create a note to work with
			.then((w) => w.note("note-1").create())
			.then((n) => n.setName({}, "Note 1"))
	);

	// Explicitly navigate to the note page
	await page.goto(`${baseURL}/preview/inventory/inbound/${versionId("wh-1/inbound/note-1")}`);

	const sidebar = getDashboard(page).sidebar();

	// The "All" group in the sidebar should be closed (as initial state)
	await sidebar.linkGroup("All").assertClosed();
	// The "Warehouse 1" group in the sidebar should be open
	await sidebar.linkGroup("Warehouse 1").assertOpen();
});

test("should not close the side link group (open by clicking on it) on route change", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			// Create a warehouse to work with
			.warehouse("wh-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
			// Create a note to work with
			.then((w) => w.note("note-1").create())
			.then((n) => n.setName({}, "Note 1"))
	);

	const sidebar = getDashboard(page).sidebar();

	// Go to the note page
	await sidebar.linkGroup("Warehouse 1").open();
	await sidebar.linkGroup("Warehouse 1").link("Note 1").click();
	await getDashboard(page).content().heading("Note 1").waitFor();

	// Open the "All" sidebar group
	await sidebar.linkGroup("All").open();

	// Double check that both groups are open
	await sidebar.linkGroup("All").assertOpen();
	await sidebar.linkGroup("Warehouse 1").assertOpen();

	// Add a new note: This changes the route, but should not close any of the open side groups
	await sidebar.linkGroup("Warehouse 1").createNote();

	// Check that both groups are still open
	await sidebar.linkGroup("All").assertOpen();
	await sidebar.linkGroup("Warehouse 1").assertOpen();
});
