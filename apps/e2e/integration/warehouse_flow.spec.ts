import { test } from "@playwright/test";

import { baseURL } from "./constants";

import { getDashboard, getDbHandle } from "@/helpers";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	await dashboard.waitFor();

	// Navigate to the inventory page
	await dashboard.navigate("inventory");
	await dashboard.content().entityList("warehouse-list").waitFor();
});

test('should create a new warehouse, on "New warehouse" and redirect to it', async ({ page }) => {
	const dashboard = getDashboard(page);

	// Create a new warehouse
	await dashboard.content().header().getByRole("button", { name: "New warehouse" }).click();

	// Check that we've been redirected to the new warehouse's page
	await dashboard.view("warehouse").waitFor();
	await dashboard.content().header().title().assert("New Warehouse");
});

test("should delete the warehouse on delete button click (after confirming the prompt)", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	await content.entityList("warehouse-list").waitFor();

	// Create two warehouses to work with
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"))
	);

	// Wait for the warehouses to appear
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }]);

	// Delete the first warehouse
	await content.entityList("warehouse-list").item(0).dropdown().delete();
	await dashboard.dialog().confirm();

	// Check that the warehouse has been deleted
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 2" }]);
});

test("warehouse heading should display warehouse name", async ({ page }) => {
	const dashboard = getDashboard(page);

	const header = dashboard.content().header();

	await header.createWarehouse();
});

test("warehouse page: should display breadcrumbs leading back to warehouse page", async ({ page }) => {
	const dashboard = getDashboard(page);

	const header = dashboard.content().header();

	await header.createWarehouse();

	await header.breadcrumbs().waitFor();

	await header.breadcrumbs().assert(["Warehouses", "New Warehouse"]);

	await header.breadcrumbs().getByText("Warehouses").click();

	await dashboard.view("inventory").waitFor();
	await dashboard.content().entityList("warehouse-list").waitFor();
});

test("should assign default name to warehouses in sequential order", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();
	const header = dashboard.content().header();

	// First warehouse
	await header.createWarehouse();
	await header.title().assert("New Warehouse");

	await dashboard.navigate("inventory");

	// Second warehouse
	await header.createWarehouse();
	await header.title().assert("New Warehouse (2)");

	// Should display created warehouses in the warehouse list (on inventory page)
	await dashboard.navigate("inventory");

	const entityList = content.entityList("warehouse-list");

	await entityList.waitFor();

	await entityList.assertElements([
		{ name: "New Warehouse", numBooks: 0 },
		{ name: "New Warehouse (2)", numBooks: 0 }
	]);
});

test("should continue the naming sequence from the highest sequenced warehouse name (even if lower sequenced warehouses have been renamed)", async ({
	page
}) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create three warehouses (default names: "New Warehouse", "New Warehouse (2)", "New Warehouse (3)")
	//
	// TODO: Check this: this expects warehouses to be displayed in the order they were created,
	// maybe we want the reverse order (or lexicographical order)
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").create());
	await dbHandle.evaluate((db) => db.warehouse("warehouse-2").create());
	await dbHandle.evaluate((db) => db.warehouse("warehouse-3").create());

	// Rename the first two warehouses (leaving us with only "New Warehouse (3)", having the default name)
	await dbHandle.evaluate((db) =>
		Promise.all([db.warehouse("warehouse-1").setName({}, "Warehouse 1"), db.warehouse("warehouse-2").setName({}, "Warehouse 2")])
	);

	// Check names
	await content
		.entityList("warehouse-list")
		.assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }, { name: "New Warehouse (3)" }]);

	// TODO: the following should be refactored to use the dashboard (when the renaming functionality is in).
	// For now we're using the db directly (not really e2e way).
	//
	// Create a new warehouse (should continue the sequence)
	await dbHandle.evaluate((db) => db.warehouse("warehouse-4").create());
	await content
		.entityList("warehouse-list")
		.assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }, { name: "New Warehouse (3)" }, { name: "New Warehouse (4)" }]);

	// Rename the remaining warehouses with default names
	await dbHandle.evaluate((db) =>
		Promise.all([db.warehouse("warehouse-3").setName({}, "Warehouse 3"), db.warehouse("warehouse-4").setName({}, "Warehouse 4")])
	);
	await content
		.entityList("warehouse-list")
		.assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }, { name: "Warehouse 3" }, { name: "Warehouse 4" }]);

	// Create a new warehouse (should reset the sequence)
	await dbHandle.evaluate((db) => db.warehouse("warehouse-5").create());
	await content
		.entityList("warehouse-list")
		.assertElements([
			{ name: "Warehouse 1" },
			{ name: "Warehouse 2" },
			{ name: "Warehouse 3" },
			{ name: "Warehouse 4" },
			{ name: "New Warehouse" }
		]);
});

test("should navigate to warehouse page on 'View stock' button click", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	// Create two warehouses to work with
	//
	// TODO: Check this: this expects warehouses to be displayed in the order they were created,
	// maybe we want the reverse order (or lexicographical order)
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"))
	);
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1" }, { name: "Warehouse 2" }]);

	// Navigate to first warehouse
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();

	// Check title
	await dashboard.view("warehouse").waitFor();
	await content.header().title().assert("Warehouse 1");

	// Navigate back to inventory page and to second warehouse
	await dashboard.navigate("inventory");
	await content.entityList("warehouse-list").item(1).dropdown().viewStock();

	// Check title
	await dashboard.view("warehouse").waitFor();
	await content.header().title().assert("Warehouse 2");
});

test("should display book count and warehouse discount for each respective warehouse in the list", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create two warehouses for display
	//
	// TODO: Check this: this expects warehouses to be displayed in the order they were created,
	// maybe we want the reverse order (or lexicographical order)
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
	);
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"))
	);

	// Both should display 0 books
	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 0 },
		{ name: "Warehouse 2", numBooks: 0 }
	]);

	// Add two books to first warehouse
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note()
			.addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1111111111", quantity: 1 })
			.then((n) => n.commit({}))
	);

	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 2 },
		{ name: "Warehouse 2", numBooks: 0 }
	]);

	// Add books to second warehouse
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-2")
			.note()
			.addVolumes({ isbn: "2222222222", quantity: 1 }, { isbn: "3333333333", quantity: 1 }, { isbn: "4444444444", quantity: 1 })
			.then((n) => n.commit({}))
	);

	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 2 },
		{ name: "Warehouse 2", numBooks: 3 }
	]);

	// Add discounts to warehouses
	await dbHandle.evaluate((db) =>
		Promise.all([db.warehouse("warehouse-1").setDiscount({}, 10), db.warehouse("warehouse-2").setDiscount({}, 20)])
	);

	await content.entityList("warehouse-list").assertElements([
		{ name: "Warehouse 1", numBooks: 2, discount: 10 },
		{ name: "Warehouse 2", numBooks: 3, discount: 20 }
	]);
});

test("should update the warehouse using the 'Edit' dialog", async ({ page }) => {
	const dashboard = getDashboard(page);

	const content = dashboard.content();

	const dbHandle = await getDbHandle(page);

	// Create a warehouse to work with
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
	);
	// Set initial discount for the warehouse
	//
	// TODO: This should all have been done in the previous block, but chaining 'setName' and 'setDiscount' doesn't update the discount - investigate
	await dbHandle.evaluate((db) => db.warehouse("warehouse-1").setDiscount({}, 10));
	// Add some books to the warehouse as additional noise (to keep consistent)
	await dbHandle.evaluate((db) =>
		db
			.warehouse("warehouse-1")
			.note()
			.addVolumes({ isbn: "1234567890", quantity: 1 }, { isbn: "1111111111", quantity: 1 })
			.then((n) => n.commit({}))
	);

	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse 1", numBooks: 2, discount: 10 }]);

	// Update the warehouse using the edit dialog
	await content.entityList("warehouse-list").item(0).dropdown().edit();

	const dialog = dashboard.dialog();
	await dialog.waitFor();

	// Edit warehouse name
	const nameInput = dialog.getByRole("textbox", { name: "name" });
	await nameInput.fill("Warehouse (edited)");

	// Update discount
	const discountInput = dialog.getByRole("spinbutton", { name: "discount" });
	await discountInput.fill("15");

	// Save
	await dialog.getByRole("button", { name: "Save" }).click();
	await dialog.waitFor({ state: "detached" });

	// Check that the warehouse has been updated
	await content.entityList("warehouse-list").assertElements([{ name: "Warehouse (edited)", numBooks: 2, discount: 15 }]);
});
