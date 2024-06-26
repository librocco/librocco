import { test, expect } from "@playwright/test";

import { BookEntry } from "@librocco/db";

import { baseURL } from "@/constants";
import { getDashboard, getDbHandle } from "@/helpers";
import { getDateStub } from "@/helpers/dateStub";

const books: BookEntry[] = [
	{ isbn: "1111111111", title: "Book 1", price: 10 },
	{ isbn: "2222222222", title: "Book 2", price: 20 }
];

const TIME_DAY = 24 * 60 * 60 * 1000;

test.beforeEach(async ({ page }) => {
	await page.goto(baseURL);

	const dashboard = getDashboard(page);
	const dbHandle = await getDbHandle(page);

	// Wait for the default view to load
	await dashboard.view("stock").waitFor();

	// Create two warehouses to work with
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh1")
			.create()
			.then((w) => w.setName({}, "Warehouse 1"))
	);
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh2")
			.create()
			.then((w) => w.setName({}, "Warehouse 2"))
	);
	await dbHandle.evaluateHandle((db) => db.warehouse("wh2").setDiscount({}, 10));

	// Add book data to db as we'll be needing some book data (for testing of stats and such)
	await dbHandle.evaluateHandle((db, books) => db.books().upsert(books), books);
});

test("history/date - display", async ({ page }) => {
	const dashboard = getDashboard(page);
	const dbHandle = await getDbHandle(page);

	// Default history view (sidebar navigation) is 'history/date'
	await dashboard.navigate("history/date");
	// Default view is today
	expect(page.url().includes(new Date().toISOString().slice(0, 10))).toEqual(true);

	// Add some transactions today (by way of inbound notes)
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 1"))
			.then((n) => n.addVolumes({ isbn: "1111111111", quantity: 2 }, { isbn: "2222222222", quantity: 1 }))
			.then((n) => n.commit({}))
	);

	//  Stats should reflect the changes
	const stats = dashboard.content().historyStats();
	await stats.assert({
		// 3 books in inbound note(s)
		inboundCount: 3,
		// 2*10 + 1*20 = 40
		inboundCoverPrice: 40,
		// Same as cover price (warehouse 1 only - no discount)
		inboundDiscountedPrice: 40,
		outboundCount: 0,
		outboundCoverPrice: 0,
		outboundDiscountedPrice: 0
	});

	await dashboard
		.content()
		.table("history/date")
		.assertRows([
			{ isbn: "1111111111", title: "Book 1", quantity: 2, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "2222222222", title: "Book 2", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 1" }
		]);

	// Adding some txns to a different warehouse should be reflected in results (stats/table)
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh2")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 2"))
			.then((n) => n.addVolumes({ isbn: "1111111111", quantity: 2 }))
			.then((n) => n.commit({}))
	);

	// Note: Warehouse 2 has a 10% discount
	await stats.assert({
		// 3 + 2 = 5 books in inbound notes
		inboundCount: 5,
		// 2*10 + 2*10 + 1*20 = 60
		inboundCoverPrice: 60,
		// 2*10*0.9 (applied 10% discount) + 2*10 + 1*20 = 58
		inboundDiscountedPrice: 58,
		outboundCount: 0,
		outboundCoverPrice: 0,
		outboundDiscountedPrice: 0
	});

	await dashboard
		.content()
		.table("history/date")
		.assertRows([
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "2222222222", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 2", noteName: "Note 2" }
		]);

	// Adding additional transactions to the first warehouse should not aggregate the txns
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 3"))
			.then((n) => n.addVolumes({ isbn: "1111111111", quantity: 1 }))
			.then((n) => n.commit({}))
	);

	await stats.assert({
		// 1 + 3 + 2 = 6 books in inbound notes
		inboundCount: 6,
		// 1*10 + 2*10 + 2*10 + 1*20 = 70
		inboundCoverPrice: 70,
		// 1*10 + 2*10*0.9 (applied 10% discount) + 2*10 + 1*20 = 68
		inboundDiscountedPrice: 68,
		outboundCount: 0,
		outboundCoverPrice: 0,
		outboundDiscountedPrice: 0
	});

	await dashboard
		.content()
		.table("history/date")
		.assertRows([
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "2222222222", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 2", noteName: "Note 2" },
			{ isbn: "1111111111", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 3" }
		]);

	// Adding some outbound transactions should be reflected in the stats
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Note 4"))
			.then((n) =>
				n.addVolumes({ isbn: "1111111111", quantity: 2, warehouseId: "wh2" }, { isbn: "1111111111", quantity: 1, warehouseId: "wh1" })
			)
			.then((n) => n.commit({}))
	);

	await stats.assert({
		// 1 + 3 + 2 = 6 books in inbound notes
		inboundCount: 6,
		// 1*10 + 2*10 + 2*10 + 1*20 = 70
		inboundCoverPrice: 70,
		// 1*10 + 2*10*0.9 (applied 10% discount) + 2*10 + 1*20 = 68
		inboundDiscountedPrice: 68,
		// 2 + 1 = 3 books in outbound notes
		outboundCount: 3,
		// 2*10 + 1*10 = 30
		outboundCoverPrice: 30,
		// 2*10*0.9 + 1*10 = 28
		outboundDiscountedPrice: 28
	});

	// TODO: Really check the sorting order
	await dashboard
		.content()
		.table("history/date")
		.assertRows([
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "2222222222", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 2", noteName: "Note 2" },
			{ isbn: "1111111111", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 3" }, // TODO: check the desired sorting order
			{ isbn: "1111111111", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 4" },
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 2", noteName: "Note 4" }
		]);

	// Adding an unknown book should not break the stats (the price for the given book should be omitted)
	// The book should be displayed with default values
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 5"))
			.then((n) => n.addVolumes({ isbn: "3333333333", quantity: 2 }))
			.then((n) => n.commit({}))
	);

	await stats.assert({
		// 2 + 1 + 3 + 2 = 6 books in inbound notes
		inboundCount: 8,
		// 1*10 + 2*10 + 2*10 + 1*20 = 70 (unknown book - no price - omitted)
		inboundCoverPrice: 70,
		// 1*10 + 2*10*0.9 (applied 10% discount) + 2*10 + 1*20 = 68 (unknown book - no price - omitted)
		inboundDiscountedPrice: 68,
		// 2 + 1 = 3 books in outbound notes
		outboundCount: 3,
		// 2*10 + 1*10 = 30
		outboundCoverPrice: 30,
		// 2*10*0.9 + 1*10 = 28
		outboundDiscountedPrice: 28
	});

	await dashboard
		.content()
		.table("history/date")
		.assertRows([
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "2222222222", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 2", noteName: "Note 2" },
			{ isbn: "1111111111", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 3" },
			{ isbn: "1111111111", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 4" },
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 2", noteName: "Note 4" },
			{ isbn: "3333333333", quantity: 2, warehouseName: "Warehouse 1", noteName: "Note 5", title: "Unknown Title" }
		]);
});

test("history/date - general navigation", async ({ page }) => {
	const dashboard = getDashboard(page);

	await dashboard.navigate("history/date");
	await dashboard.content().navigate("history/isbn"); // This is our "previous" view
	await dashboard.content().navigate("history/date");

	// Navigating between dates is shallow - going back should go to previous route altogether
	const t_minus_1 = new Date(Date.now() - 1 * TIME_DAY).toISOString().slice(0, 10);
	await dashboard.content().calendar().select(t_minus_1);
	expect(page.url().includes(t_minus_1));
	const t_minus_2 = new Date(Date.now() - 2 * TIME_DAY).toISOString().slice(0, 10);
	await dashboard.content().calendar().select(t_minus_2);
	expect(page.url().includes(t_minus_2));
	const t_minus_3 = new Date(Date.now() - 3 * TIME_DAY).toISOString().slice(0, 10);
	await dashboard.content().calendar().select(t_minus_3);
	expect(page.url().includes(t_minus_3));

	// Clicking (browser) back should navigate back to the previous view
	await page.goBack();
	await dashboard.view("history/isbn").waitFor();

	// Clicking on txn's note name shold redirect to committed note page
	//
	// Navigate back to date view
	await dashboard.content().navigate("history/date");

	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 1"))
			.then((n) => n.addVolumes({ isbn: "1111111111", quantity: 1 }))
			.then((n) => n.commit({}))
	);

	await dashboard.content().table("history/date").row(0).field("noteName").click();

	// Should redirect to (committed) note page
	await dashboard.content().header().title().assert("Note 1");

	// Navigating to history/notes should preserve the selected date
	//
	// Go back to history/date
	await dashboard.navigate("history/date");
	await dashboard.content().calendar().select(t_minus_3);
	await dashboard.content().navigate("history/notes");
	expect(page.url().includes(`history/notes/${t_minus_3}`));
});

test("history/date - displaying of different date summaries", async ({ page }) => {
	const dashboard = getDashboard(page);
	const dbHandle = await getDbHandle(page);

	// Mock the date in order to be able to "commit notes" on a different date
	const dateStub = await getDateStub(page);

	// Add some transactions two days ago
	const twoDaysAgo = new Date(Date.now() - 2 * TIME_DAY);
	await dateStub.mock(twoDaysAgo);

	// Add one inbound note
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 1"))
			.then((n) => n.addVolumes({ isbn: "1111111111", quantity: 2 }, { isbn: "2222222222", quantity: 3 }))
			.then((n) => n.commit({}))
	);
	// ...and one outbound note
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Note 2"))
			.then((n) =>
				n.addVolumes({ isbn: "1111111111", quantity: 1, warehouseId: "wh1" }, { isbn: "2222222222", quantity: 1, warehouseId: "wh1" })
			)
			.then((n) => n.commit({}))
	);

	// Reset the date and add some transactions today
	await dateStub.reset();

	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse("wh1")
			.note()
			.create()
			.then((n) => n.setName({}, "Note 3"))
			.then((n) => n.addVolumes({ isbn: "1111111111", quantity: 3 }))
			.then((n) => n.commit({}))
	);
	await dbHandle.evaluateHandle((db) =>
		db
			.warehouse()
			.note()
			.create()
			.then((n) => n.setName({}, "Note 4"))
			.then((n) => n.addVolumes({ isbn: "2222222222", quantity: 1, warehouseId: "wh1" }))
			.then((n) => n.commit({}))
	);

	// Navigate to history/date page for assertions
	await dashboard.navigate("history/date");

	// Verify that the date had been reset successfully
	expect(page.url().includes(new Date().toISOString().slice(0, 10))).toEqual(true);

	//  Stats - today
	const stats = dashboard.content().historyStats();
	await stats.assert({
		// 3 books in inbound note
		inboundCount: 3,
		// 3*10 = 30
		inboundCoverPrice: 30,
		// Same as cover price (warehouse 1 only - no discount)
		inboundDiscountedPrice: 30,
		// 1 book in outbond note
		outboundCount: 1,
		// 1*20 = 20
		outboundCoverPrice: 20,
		// Same as cover price (warehouse 1 only - no discount)
		outboundDiscountedPrice: 20
	});

	await dashboard
		.content()
		.table("history/date")
		.assertRows([
			{ isbn: "1111111111", quantity: 3, warehouseName: "Warehouse 1", noteName: "Note 3" },
			{ isbn: "2222222222", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 4" }
		]);

	// Navigate two days back and check display
	await dashboard.content().calendar().select(twoDaysAgo.toISOString().slice(0, 10));

	await stats.assert({
		// 5 books in inbound note(s)
		inboundCount: 5,
		// 2*10 + 3*20 = 80
		inboundCoverPrice: 80,
		// Same as cover price - warehouse 1 - no discount
		inboundDiscountedPrice: 80,
		// 2 books in inbound note(s)
		outboundCount: 2,
		// 1*10 + 1*20 = 30
		outboundCoverPrice: 30,
		// Same as cover price - warehouse 1 - no discount
		outboundDiscountedPrice: 30
	});

	await dashboard
		.content()
		.table("history/date")
		.assertRows([
			{ isbn: "1111111111", quantity: 2, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "2222222222", quantity: 3, warehouseName: "Warehouse 1", noteName: "Note 1" },
			{ isbn: "1111111111", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 2" },
			{ isbn: "2222222222", quantity: 1, warehouseName: "Warehouse 1", noteName: "Note 2" }
		]);
});
