import { test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard, getDbHandle } from "@/helpers";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	// Navigate to warehouse-list view and wait for the page to load
	const dashboard = getDashboard(page);
	await dashboard.navigate("inventory");
	await dashboard.content().entityList("warehouse-list").waitFor();

	// We're creating one warehouse (for each test) and are using its stock view as default view
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		db
			.warehouse("warehouse-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
	);

	// Navigate to "Warehouse 1" stock view
	await dashboard.content().entityList("warehouse-list").item(0).dropdown().viewStock();
	await dashboard.view("warehouse").waitFor();
	await dashboard.content().header().title().assert("Warehouse 1");
});

test("should update the stock when the inbound note is committed", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		db
			// Create one inbound note
			.warehouse("warehouse-1")
			.note()
			.create()
			.then((n) => n.setName({}, "Test Note"))
			// Add two transactions to the note
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }, { isbn: "1234567891", quantity: 3 }))
	);

	// Initial view: Warehouse 1 stock page

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// No table should be shown for "Warehouse 1"
	await content.table("warehouse").waitFor({ state: "detached" });

	// Navigate to "Test Note" page and commit the note
	await content.header().breadcrumbs().getByText("Warehouses").click();
	await dashboard.view("inventory").waitFor();
	await content.getByText("Inbound").click();
	await content.entityList("inbound-list").item(0).edit();
	await dashboard.view("inbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	// Committed transactions should be reflected in "Warehouse 1" stock
	//
	// After committing, we've been redirected to the inbound list view
	// Navigate to warehouse page (through warehouse list)
	await content.navigate("warehouse-list");
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.header().title().assert("Warehouse 1");
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 2 },
		{ isbn: "1234567891", quantity: 3 }
	]);
});

test("should aggrgate the transactions of the same isbn and warehouse (in stock) when the inbound note is committed", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		const wh1 = db.warehouse("warehouse-1");

		await Promise.all([
			// Add some stock to the warehouse (through the inbound note)
			wh1
				.note()
				.create()
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }, { isbn: "1234567891", quantity: 3 }))
				.then((n) => n.commit({})),

			// Create another (non-committed) note
			wh1
				.note()
				.create()
				.then((n) => n.setName({}, "Test Note"))
				// Add two transactions to the note
				.then((n) => n.addVolumes({ isbn: "1234567891", quantity: 2 }, { isbn: "1234567893", quantity: 1 }))
		]);
	});

	// Initial view: Warehouse 1 stock page

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Check the stock before committing the (second) note
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 2 },
		{ isbn: "1234567891", quantity: 3 }
	]);

	// Navigate to "Test Note" page and commit the note
	await content.header().breadcrumbs().getByText("Warehouses").click();
	await dashboard.view("inventory").waitFor();
	await content.navigate("inbound-list");
	await content.entityList("inbound-list").item(0).edit();
	await dashboard.view("inbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	// Committed transactions should be aggregated in "Warehouse 1" stock
	//
	// After committing, we've been redirected to the inbound list view
	// Navigate to warehouse page (through warehouse list)
	await content.navigate("warehouse-list");
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.header().title().assert("Warehouse 1");
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 2 },
		{ isbn: "1234567891", quantity: 5 },
		{ isbn: "1234567893", quantity: 1 }
	]);
});

test('warehouse stock page should show only the stock for a praticular warehouse, "All" should show all', async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		Promise.all([
			// Add some stock to Warehouse 1
			db
				.warehouse("warehouse-1")
				.note()
				.create()
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }))
				.then((n) => n.commit({})),

			// Create a second warehouse and add some stock to it
			db
				.warehouse("warehouse-2")
				.create()
				.then((wh) => wh.setName({}, "Warehouse 2"))
				.then((wh) => wh.note().create())
				.then((n) => n.addVolumes({ isbn: "1234567891", quantity: 3 }))
				.then((n) => n.commit({}))
		])
	);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	// Check "Warehouse 1" stock view
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 2 }]);

	// Navigate to "Warehouse 2" and check stock
	await content.header().breadcrumbs().getByText("Warehouses").click();
	await content.entityList("warehouse-list").item(1).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567891", quantity: 3 }]);
});

test("committing an outbound note should decrement the stock by the quantities in its transactions", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		Promise.all([
			// Add some stock to Warehouse 1
			db
				.warehouse("warehouse-1")
				.note()
				.create()
				.then((n) =>
					n.addVolumes({ isbn: "1234567890", quantity: 3 }, { isbn: "1234567891", quantity: 5 }, { isbn: "1234567892", quantity: 2 })
				)
				.then((n) => n.commit({})),

			// Create (but don't commit) an outbound note with two tranasctions (with isbns of stock already contained in the warehouse)
			db
				.warehouse()
				.note()
				.create()
				.then((n) => n.setName({}, "Test Note"))
				.then((n) =>
					n.addVolumes(
						{ isbn: "1234567890", quantity: 2, warehouseId: "warehouse-1" },
						{ isbn: "1234567891", quantity: 3, warehouseId: "warehouse-1" }
					)
				)
		])
	);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	// Check stock before committing the note
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 3 },
		{ isbn: "1234567891", quantity: 5 },
		{ isbn: "1234567892", quantity: 2 }
	]);

	// Navigate to the note and commit it
	await dashboard.navigate("outbound");
	await content.entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	// Navigate back to "Warehouse 1" page and check the updated stock
	await dashboard.navigate("inventory");
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 1 },
		{ isbn: "1234567891", quantity: 2 },
		{ isbn: "1234567892", quantity: 2 }
	]);
});

test("should remove 0 quantity stock entries from the stock", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		Promise.all([
			// Create a warehouse and set it up with two transactions
			db
				.warehouse("warehouse-1")
				.note()
				.create()
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 3 }, { isbn: "1234567891", quantity: 5 }))
				.then((n) => n.commit({})),

			// Create (but don't commit) an outbound note with transaction, which, when committed should result in 0-quantity
			db
				.warehouse()
				.note()
				.create()
				.then((n) => n.setName({}, "Test Note"))
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 3, warehouseId: "warehouse-1" }))
		])
	);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	//  Check the stock before committing the note
	await content.table("warehouse").assertRows([
		{ isbn: "1234567890", quantity: 3 },
		{ isbn: "1234567891", quantity: 5 }
	]);

	// Commit the outbound note
	await dashboard.navigate("outbound");
	await content.entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	//  Check the updated stock
	await dashboard.navigate("inventory");
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567891", quantity: 5 }]);
});

test("committing an outbound note with transactions in two warehouses should decrement the stock in both", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) =>
		Promise.all([
			// Add some stock to warehouse-1
			db
				.warehouse("warehouse-1")
				.create()
				.then((wh) => wh.setName({}, "Warehouse 1"))
				.then((wh) => wh.note().create())
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }))
				.then((n) => n.commit({})),

			// Create warehouse 2 and add some stock to it
			db
				.warehouse("warehouse-2")
				.create()
				.then((wh) => wh.setName({}, "Warehouse 2"))
				.then((wh) => wh.note().create())
				.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 3 }))
				.then((n) => n.commit({})),

			// Create (but don't commit) an outbound note with two tranasctions (with isbns of stock already contained in the warehouse, one in each)
			db
				.warehouse()
				.note()
				.create()
				.then((n) => n.setName({}, "Test Note"))
				.then((n) =>
					n.addVolumes(
						{ isbn: "1234567890", quantity: 1, warehouseId: "warehouse-1" },
						{ isbn: "1234567890", quantity: 1, warehouseId: "warehouse-2" }
					)
				)
		])
	);

	const dashboard = getDashboard(page);
	const content = dashboard.content();

	// Initial view: Warehouse 1 stock page

	// Check the stock before committing the note
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 2 }]);

	// Navigate to the note and commit it
	await dashboard.navigate("outbound");
	await content.entityList("outbound-list").item(0).edit();
	await dashboard.view("outbound-note").waitFor();
	await content.header().commit();
	await dashboard.dialog().confirm();

	// Check the updated stock - warehouse 1
	await dashboard.navigate("inventory");
	await content.entityList("warehouse-list").item(0).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 1 }]);

	// Check the updated stock - warehouse 2
	await content.header().breadcrumbs().getByText("Warehouses").click();
	await content.entityList("warehouse-list").item(1).dropdown().viewStock();
	await content.table("warehouse").assertRows([{ isbn: "1234567890", quantity: 2 }]);
});
