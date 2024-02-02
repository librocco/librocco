import { test } from "@playwright/test";

import { baseURL } from "./constants";
import { assertionTimeout } from "@/constants";

import { getDashboard, getDbHandle } from "@/helpers";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the outbound note page
	await dashboard.navigate("outbound");
});

test('should create a new outbound note, on "Create note" and redirect to it', async ({ page }) => {
	const dasbboard = getDashboard(page);

	// Create a new note
	await dasbboard.content().header().getByRole("button", { name: "New note" }).click();

	// Check that we've been redirected to the new note's page
	await dasbboard.content().header().title().assert("New Note");
});

test("should delete the note on delete button click (after confirming the prompt)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two notes to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-2")
			.create()
			.then((n) => n.setName({}, "Note 2"))
	);

	// Wait for the notes to appear
	await content.entityList().assertElements([{ name: "Note 1" }, { name: "Note 2" }]);

	// Delete the first note
	await content.entityList().item(0).delete();
	await dashboard.dialog().confirm();

	// Check that the note has been deleted
	await content.entityList().assertElements([{ name: "Note 2" }]);
});

test("note heading should display note name, 'updated at' timestamp and note state", async ({ page }) => {
	const dasbboard = getDashboard(page);

	const header = dasbboard.content().header();

	await header.createNote();

	// Check the 'updated at' timestamp
	const updatedAt = new Date();
	await header.updatedAt().assert(updatedAt, { timeout: assertionTimeout });
});

test("note should display breadcrumbs leading back to outbound page", async ({ page }) => {
	const dashboard = getDashboard(page);

	const header = dashboard.content().header();

	await header.createNote();

	await header.breadcrumbs().waitFor();

	await header.breadcrumbs().assert(["Outbound", "New Note"]);

	await header.breadcrumbs().getByText("Outbound").click();

	await dashboard.view("outbound").waitFor();
});

test("should assign default name to notes in sequential order", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const header = dashboard.content().header();

	// First note
	await header.createNote();
	await header.title().assert("New Note");
	const note1UpdatedAt = await header.updatedAt().value();

	await dashboard.navigate("outbound");

	// Second note
	await header.createNote();
	await header.title().assert("New Note (2)");
	const note2UpdatedAt = await header.updatedAt().value();

	// Should display created notes in the outbound note list
	await dashboard.navigate("outbound");

	const entityList = content.entityList();

	await entityList.waitFor();

	await entityList.assertElements([
		{ name: "New Note", numBooks: 0, updatedAt: note1UpdatedAt },
		{ name: "New Note (2)", numBooks: 0, updatedAt: note2UpdatedAt }
	]);
});

test("should continue the naming sequence from the highest sequenced note name (even if lower sequenced notes have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create three notes (default names: "New Note", "New Note (2)", "New Note (3)")
	//
	// TODO: Check this: this expects notes to be displayed in the order they were created,
	// maybe we want the reverse order (or lexicographical order)
	await dbHandle.evaluate((db) => db.warehouse().note("note-1").create());
	await dbHandle.evaluate((db) => db.warehouse().note("note-2").create());
	await dbHandle.evaluate((db) => db.warehouse().note("note-3").create());

	// Rename the first two notes (leaving us with only "New Note (3)", having the default name)
	await dbHandle.evaluate((db) =>
		Promise.all([db.warehouse().note("note-1").setName({}, "Note 1"), db.warehouse().note("note-2").setName({}, "Note 2")])
	);

	// Check names
	await content.entityList().assertElements([{ name: "Note 1" }, { name: "Note 2" }, { name: "New Note (3)" }]);

	// TODO: the following should be refactored to use the dashboard (when the renaming functionality is in).
	// For now we're using the db directly (not really e2e way).
	//
	// Create a new note (should continue the sequence)
	await dbHandle.evaluate((db) => db.warehouse().note("note-4").create());
	await content.entityList().assertElements([{ name: "Note 1" }, { name: "Note 2" }, { name: "New Note (3)" }, { name: "New Note (4)" }]);

	// Rename the remaining notes with default names
	await dbHandle.evaluate((db) =>
		Promise.all([db.warehouse().note("note-3").setName({}, "Note 3"), db.warehouse().note("note-4").setName({}, "Note 4")])
	);
	await content.entityList().assertElements([{ name: "Note 1" }, { name: "Note 2" }, { name: "Note 3" }, { name: "Note 4" }]);

	// Create a new note (should reset the sequence)
	await dbHandle.evaluate((db) => db.warehouse().note("note-5").create());
	await content
		.entityList()
		.assertElements([{ name: "Note 1" }, { name: "Note 2" }, { name: "Note 3" }, { name: "Note 4" }, { name: "New Note" }]);
});

test("should navigate to note page on 'edit' button click", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two notes to work with
	//
	// TODO: Check this: this expects notes to be displayed in the order they were created,
	// maybe we want the reverse order (or lexicographical order)
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Note 2"))
	);
	await content.entityList().assertElements([{ name: "Note 1" }, { name: "Note 2" }]);

	// Navigate to first note
	await content.entityList().item(0).edit();

	// Check title
	await dashboard.view("outbound-note").waitFor();
	await content.header().title().assert("Note 1");

	// Navigate back to outbond page and to second note
	await dashboard.navigate("outbound");
	await content.entityList().item(1).edit();

	// Check title
	await dashboard.view("outbound-note").waitFor();
	await content.header().title().assert("Note 2");
});

test("should display book count for each respective note in the list", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create two notes for display
	//
	// TODO: Check this: this expects notes to be displayed in the order they were created,
	// maybe we want the reverse order (or lexicographical order)
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-1")
			.create()
			.then((n) => n.setName({}, "Note 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-2")
			.create()
			.then((n) => n.setName({}, "Note 2"))
	);

	// Both should display 0 books
	await content.entityList().assertElements([
		{ name: "Note 1", numBooks: 0 },
		{ name: "Note 2", numBooks: 0 }
	]);

	// Add two books to first note
	await dbHandle.evaluate((db) =>
		db.warehouse().note("note-1").addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1111111111", quantity: 1 })
	);

	await content.entityList().assertElements([
		{ name: "Note 1", numBooks: 2 },
		{ name: "Note 2", numBooks: 0 }
	]);

	// Add books to second note
	await dbHandle.evaluate((db) =>
		db
			.warehouse()
			.note("note-2")
			.addVolumes({ isbn: "2222222222", quantity: 1 }, { isbn: "3333333333", quantity: 1 }, { isbn: "4444444444", quantity: 1 })
	);

	await content.entityList().assertElements([
		{ name: "Note 1", numBooks: 2 },
		{ name: "Note 2", numBooks: 3 }
	]);
});
