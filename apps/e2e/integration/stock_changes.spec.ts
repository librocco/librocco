import { NoteState } from "@librocco/shared";
import { expect, test } from "@playwright/test";

import { baseURL } from "../constants";

import { getDashboard, getDbHandle } from "../helpers";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);

	// Wait for the app to become responsive
	const dashboard = getDashboard(page);
	await dashboard.waitFor();
});

test("should update the stock when the inbound note is committed", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		await db
			// Create a warehouse to house the note
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
			// Create one inbound note
			.then((wh) => wh.note().create())
			.then((n) => n.setName({}, "Test Note"))
			// Add two transactions to the note
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }, { isbn: "1234567891", quantity: 3 }));
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();
	const sidebar = dashboard.sidebar();

	// Stock page
	//
	// Navigate to "Warehouse 1" page
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();

	// No table should be shown for "Warehouse 1"
	await expect(content.entries("stock")).not.toBeAttached();

	// Navigate to "Test Note" page and commit the note
	await dashboard.navigate("inbound");
	await sidebar.linkGroup("Warehouse 1").open();
	await sidebar.linkGroup("Warehouse 1").link("Test Note").click();
	await content.heading("Test Note").waitFor();
	await content.statePicker().select(NoteState.Committed);

	// Committed transactions should be reflected in "Warehouse 1" stock
	await dashboard.navigate("stock");
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		},
		{
			isbn: "1234567891",
			quantity: 3
		}
	]);

	// All stock should also display the tow transactions
	await sidebar.link("All").click();
	await content.heading("All").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		},
		{
			isbn: "1234567891",
			quantity: 3
		}
	]);
});

test("should aggrgate the transactions of the same isbn and warehouse (in stock) when the inbound note is committed", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		const wh1 = await db
			// Create a warehouse to house the note
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"));

		// Create one inbound note
		wh1
			.note()
			.create()
			// Add two transactions to the note
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }, { isbn: "1234567891", quantity: 3 }))
			// Commit the note (adding transactions to the stock)
			.then((n) => n.commit({}));

		// Create another (non-committed) note
		wh1
			.note()
			.create()
			.then((n) => n.setName({}, "Test Note"))
			// Add two transactions to the note
			.then((n) => n.addVolumes({ isbn: "1234567891", quantity: 2 }, { isbn: "1234567893", quantity: 1 }));
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();
	const sidebar = dashboard.sidebar();

	// Stock page ("All" pesudo-warehouse view)
	//
	// Warehouses should show the transactions from the first note
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		},
		{
			isbn: "1234567891",
			quantity: 3
		}
	]);

	// "Warehouse 1" view
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		},
		{
			isbn: "1234567891",
			quantity: 3
		}
	]);

	// Navigate to "Test Note" page and commit the note
	await dashboard.navigate("inbound");
	await sidebar.linkGroup("Warehouse 1").open();
	await sidebar.linkGroup("Warehouse 1").link("Test Note").click();
	await content.heading("Test Note").waitFor();
	await content.statePicker().select(NoteState.Committed);

	// Navigate back to stock page ("All" pseudo-warehouse view)
	await dashboard.navigate("stock");

	// "All" should show the aggregated state of the transactions from both notes
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		},
		{
			isbn: "1234567891",
			quantity: 5
		},
		{
			isbn: "1234567893",
			quantity: 1
		}
	]);

	// Committed transactions should be reflected in "Warehouse 1" stock
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		},
		{
			isbn: "1234567891",
			quantity: 5
		},
		{
			isbn: "1234567893",
			quantity: 1
		}
	]);
});

test('warehouse stock page should show only the stock for a praticular warehouse, "All" should show all', async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create two warehouses, each with a note
		await db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
			.then((wh) => wh.note().create())
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }))
			.then((n) => n.commit({}));

		await db
			.warehouse("wh-2")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 2"))
			.then((wh) => wh.note().create())
			.then((n) => n.addVolumes({ isbn: "1234567891", quantity: 3 }))
			.then((n) => n.commit({}));
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();
	const sidebar = dashboard.sidebar();

	// Stock page ("All" pesudo-warehouse view)
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		},
		{
			isbn: "1234567891",
			quantity: 3
		}
	]);

	// Check "Warehouse 1" stock view
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		}
	]);

	// Check "Warehouse 2" stock view
	await sidebar.link("Warehouse 2").click();
	await content.heading("Warehouse 2").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567891",
			quantity: 3
		}
	]);
});

test("committing an outbound note should decrement the stock by the quantities in its transactions", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create a warehouse and set it up with three transactions
		await db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
			.then((wh) => wh.note().create())
			.then((n) =>
				n.addVolumes({ isbn: "1234567890", quantity: 3 }, { isbn: "1234567891", quantity: 5 }, { isbn: "1234567892", quantity: 2 })
			)
			.then((n) => n.commit({}));

		// Create (but don't commit) an outbound note with two tranasctions (with isbns of stock already contained in the warehouse)
		await db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Test Note"))
			.then((n) =>
				n.addVolumes({ isbn: "1234567890", quantity: 2, warehouseId: "wh-1" }, { isbn: "1234567891", quantity: 3, warehouseId: "wh-1" })
			);
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();
	const sidebar = dashboard.sidebar();

	// Stock page ("All" pesudo-warehouse view)
	//
	// Check the stock before committing the outbound note
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 3
		},
		{
			isbn: "1234567891",
			quantity: 5
		},
		{
			isbn: "1234567892",
			quantity: 2
		}
	]);

	// Check the stock for "Warehouse 1" before committing the outbound note
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 3
		},
		{
			isbn: "1234567891",
			quantity: 5
		},
		{
			isbn: "1234567892",
			quantity: 2
		}
	]);

	// Navigate to outbound page and commit the note
	await dashboard.navigate("outbound");
	await sidebar.link("Test Note").click();
	await content.heading("Test Note").waitFor();
	await content.statePicker().select(NoteState.Committed);

	// Check the updated stock
	await dashboard.navigate("stock");

	// "All" pseudo warehouse view
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 1
		},
		{
			isbn: "1234567891",
			quantity: 2
		},
		{
			isbn: "1234567892",
			quantity: 2
		}
	]);

	// "Warehouse 1" view
	await sidebar.link("Warehouse 1").click();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 1
		},
		{
			isbn: "1234567891",
			quantity: 2
		},
		{
			isbn: "1234567892",
			quantity: 2
		}
	]);
});

test("should remove 0 quantity stock entries from the stock", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create a warehouse and set it up with two transactions
		await db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
			.then((wh) => wh.note().create())
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 3 }, { isbn: "1234567891", quantity: 5 }))
			.then((n) => n.commit({}));

		// Create (but don't commit) an outbound note with transaction, which, when committed should result in 0-quantity
		await db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Test Note"))
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 3, warehouseId: "wh-1" }));
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();
	const sidebar = dashboard.sidebar();

	// Check the stock before committing the outbound note
	//
	// Stock page ("All" pesudo-warehouse view)
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 3
		},
		{
			isbn: "1234567891",
			quantity: 5
		}
	]);

	// "Warehouse 1" view
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 3
		},
		{
			isbn: "1234567891",
			quantity: 5
		}
	]);

	// Commit the outbound note
	await dashboard.navigate("outbound");
	await sidebar.link("Test Note").click();
	await content.heading("Test Note").waitFor();
	await content.statePicker().select(NoteState.Committed);

	// The transaction should be removed from both the "All" stock as well as "Warehouse 1"
	await dashboard.navigate("stock");

	// "All" pseudo warehouse view
	await content.entries("stock").assertRows([
		{
			isbn: "1234567891",
			quantity: 5
		}
	]);

	// "Warehouse 1" view
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567891",
			quantity: 5
		}
	]);
});

test("committing an outbound note with transactions in two warehouses should decrement the stock in both", async ({ page }) => {
	// Setup
	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(async (db) => {
		// Create two warehouses, each with a transaction
		await db
			.warehouse("wh-1")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 1"))
			.then((wh) => wh.note().create())
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 2 }))
			.then((n) => n.commit({}));

		await db
			.warehouse("wh-2")
			.create()
			.then((wh) => wh.setName({}, "Warehouse 2"))
			.then((wh) => wh.note().create())
			.then((n) => n.addVolumes({ isbn: "1234567890", quantity: 3 }))
			.then((n) => n.commit({}));

		// Create (but don't commit) an outbound note with two tranasctions (with isbns of stock already contained in the warehouse, one in each)
		await db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Test Note"))
			.then((n) =>
				n.addVolumes({ isbn: "1234567890", quantity: 1, warehouseId: "wh-1" }, { isbn: "1234567890", quantity: 1, warehouseId: "wh-2" })
			);
	});

	const dashboard = getDashboard(page);
	const content = dashboard.content();
	const sidebar = dashboard.sidebar();

	// Stock page ("All" pesudo-warehouse view)
	//
	// Should display both transactions
	await content.entries("stock").assertRows([
		// "1234567890" in "Warehouse 1"
		{
			isbn: "1234567890",
			quantity: 2
		},
		// "1234567890" in "Warehouse 2"
		{
			isbn: "1234567890",
			quantity: 3
		}
	]);

	// "Warehouse 1" view
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		}
	]);

	// "Warehouse 2" view
	await sidebar.link("Warehouse 2").click();
	await content.heading("Warehouse 2").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 3
		}
	]);

	// Navigate to outbound page and commit the note
	await dashboard.navigate("outbound");
	await sidebar.link("Test Note").click();
	await content.heading("Test Note").waitFor();
	await content.statePicker().select(NoteState.Committed);

	// Check the updated stock
	await dashboard.navigate("stock");

	// "All" pseudo warehouse view
	await content.entries("stock").assertRows([
		// "1234567890" in "Warehouse 1"
		{
			isbn: "1234567890",
			quantity: 1
		},
		// "1234567890" in "Warehouse 2"
		{
			isbn: "1234567890",
			quantity: 2
		}
	]);

	// "Warehouse 1" view
	await sidebar.link("Warehouse 1").click();
	await content.heading("Warehouse 1").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 1
		}
	]);

	// "Warehouse 2" view
	await sidebar.link("Warehouse 2").click();
	await content.heading("Warehouse 2").waitFor();
	await content.entries("stock").assertRows([
		{
			isbn: "1234567890",
			quantity: 2
		}
	]);
});
