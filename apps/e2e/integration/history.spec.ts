import { expect } from "@playwright/test";

import type { BookData } from "@librocco/shared";

import { appHash } from "@/constants";
import { testBase as test } from "@/helpers/fixtures";
import { getDashboard, getDbHandle } from "@/helpers";
import { upsertWarehouse, createInboundNote, createOutboundNote, addVolumesToNote, commitNote, upsertBook } from "../helpers/cr-sqlite";
import { getDateStub } from "@/helpers/dateStub";

const books: BookData[] = [
	{ isbn: "1111111111", title: "Book 1", authors: "Author 1", publisher: "Publisher 1", year: "2021", price: 10 },
	{ isbn: "2222222222", title: "Book 2", authors: "Author 2", publisher: "Publisher 2", year: "2022", price: 20 }
];

const TIME_MIN = 60 * 1000;
const TIME_DAY = 24 * 60 * TIME_MIN;

test.beforeEach(async ({ page }) => {
	await page.goto(appHash("history/date"));

	const dbHandle = await getDbHandle(page);

	// Create two warehouses to work with
	await dbHandle.evaluate(upsertWarehouse, { id: 1, displayName: "Warehouse 1" });
	await dbHandle.evaluate(upsertWarehouse, { id: 2, displayName: "Warehouse 2", discount: 10 });

	// Add book data to db as we'll be needing some book data (for testing of stats and such)
	await dbHandle.evaluate(upsertBook, books[0]);
	await dbHandle.evaluate(upsertBook, books[1]);
});

test("history/date - display", async ({ page }) => {
	const dashboard = getDashboard(page);
	// Instead of `dbHandle` this test uses `(await getDbHandle(page))` so it works after a page reload
	// const dbHandle = await getDbHandle(page);

	// Default history view (sidebar navigation) is 'history/date'
	await page.goto(appHash("history/date"));

	// Default view is today
	expect(page.url().includes(new Date().toISOString().slice(0, 10))).toEqual(true);

	// Add some transactions today (by way of inbound notes)
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "2222222222", quantity: 1, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 1);

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
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 2, warehouseId: 2, displayName: "Note 2" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [2, { isbn: "1111111111", quantity: 2, warehouseId: 2 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 2);

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
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 3, warehouseId: 1, displayName: "Note 3" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [3, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 3);

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
	await (await getDbHandle(page)).evaluate(createOutboundNote, { id: 4, displayName: "Note 4" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [4, { isbn: "1111111111", quantity: 2, warehouseId: 2 }] as const);
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [4, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 4);

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
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 5, warehouseId: 1, displayName: "Note 5" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [5, { isbn: "3333333333", quantity: 2, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 5);

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

	await page.getByRole("link", { name: "By ISBN" }).click(); // This is our "previous" view
	await page.waitForURL("**/history/isbn/**/");

	await page.getByRole("link", { name: "By Date", exact: true }).click();
	await page.waitForURL("**/history/date/**/");

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
	await page.getByRole("link", { name: "By Date", exact: true }).click();
	await page.waitForURL("**/history/date/**/");

	// Instead of `dbHandle` this test uses `(await getDbHandle(page))` so it works after a page reload
	// const dbHandle = await getDbHandle(page);

	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 1);

	await dashboard.content().table("history/date").row(0).field("noteName").click();

	// Should redirect to (committed) note page
	await dashboard.content().header().title().assert("Note 1");

	// Navigating to history/notes should preserve the selected date
	//
	// Go back to history/date
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");

	await dashboard.content().calendar().select(t_minus_3);

	await page.getByRole("link", { name: "Notes by Date" }).click();
	await page.waitForURL("**/history/notes/**/");

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
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "2222222222", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);
	// ...and one outbound note
	await dateStub.mock(new Date(Number(twoDaysAgo) + 2)); // Commit the note just 2ms after the first one
	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Note 2" });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "2222222222", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Reset the date and add some transactions today
	await dateStub.reset();

	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 1, displayName: "Note 3" });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "1111111111", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 3);
	await dbHandle.evaluate(createOutboundNote, { id: 4, displayName: "Note 4" });
	await dbHandle.evaluate(addVolumesToNote, [4, { isbn: "2222222222", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 4);

	// Navigate to history/date page for assertions
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");

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

test("history/isbn - base functionality", async ({ page }) => {
	const dashboard = getDashboard(page);

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/isbn' subview
	await page.getByRole("link", { name: "By ISBN" }).click();
	await page.waitForURL("**/history/isbn/**/");

	// Without selected isbn, a message (to select an isbn) should be shown
	await dashboard.content().getByText("No book selected").waitFor();
	await dashboard.content().getByText("Use the search field to find the book you're looking for").waitFor();

	// We're able to navigate to the book by typing in the isbn (into the search field) and pressing enter
	await dashboard.content().searchField().type("1234567890");
	await page.keyboard.press("Enter");

	// No transactions - should show the appropriate message
	await dashboard.content().getByText("No transactions found").waitFor();
	await dashboard.content().getByText("There seems to be no record of transactions for the given isbn volumes going in or out").waitFor();
});

// This test is a product of a regression we had
test("history/isbn - search results", async ({ page }) => {
	const dashboard = getDashboard(page);
	const dbHandle = await getDbHandle(page);
	const search = dashboard.content().searchField();

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/isbn' subview
	await page.getByRole("link", { name: "By ISBN" }).click();
	await page.waitForURL("**/history/isbn/**/");

	// Searching for a book that exists in two warehouses should display only one result
	//
	// Add the same book in two warehouses
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await dbHandle.evaluate(createInboundNote, { id: 2, warehouseId: 2, displayName: "Note 2" });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1111111111", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Check search results
	await search.type("Book 1");
	await search.completions().assert([
		{
			isbn: "1111111111",
			title: "Book 1",
			authors: "Author 1",
			publisher: "Publisher 1",
			year: "2021"
		}
	]);

	// Searching for a book that doesn't exist in stock (currently), but exists as book entry should be displayed in the results all the same
	await search.clear();
	await search.type("Book 2");
	await search.completions().assert([
		{
			isbn: "2222222222",
			title: "Book 2",
			authors: "Author 2",
			publisher: "Publisher 2",
			year: "2022"
		}
	]);

	// Full text search shold be applied (show multiple results if multiple matched)
	await search.clear();
	await search.type("Book");
	await search.completions().assert([
		{
			isbn: "1111111111",
			title: "Book 1",
			authors: "Author 1",
			publisher: "Publisher 1",
			year: "2021"
		},
		{
			isbn: "2222222222",
			title: "Book 2",
			authors: "Author 2",
			publisher: "Publisher 2",
			year: "2022"
		}
	]);
});

test("history/isbn - transaction display", async ({ page }) => {
	const dashboard = getDashboard(page);
	// Instead of `dbHandle` this test uses `(await getDbHandle(page))` so it works after a page reload
	// const dbHandle = await getDbHandle(page);
	const search = dashboard.content().searchField();

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/isbn' subview
	await page.getByRole("link", { name: "By ISBN" }).click();
	await page.waitForURL("**/history/isbn/**/");

	// Navigate to the page for 1111111111
	await search.type("1111111111");
	await search.completions().n(0).click();

	// Check the book data header
	await dashboard.content().header().title().assert("1111111111");
	await dashboard.content().header().getByText("Book 1").waitFor();
	await dashboard.content().header().getByText("Author 1").waitFor();
	await dashboard.content().header().getByText("Publisher 1").waitFor();
	await dashboard.content().header().getByText("2021").waitFor();

	// Add some trasnactions
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 1);
	const txn2Date = await (await getDbHandle(page)).evaluate(() => new Date().toISOString().slice(0, 10));

	// Stock should be updated
	await dashboard
		.content()
		.stockReport()
		.assert([["Warehouse 1", 2]]);

	// Transaction should be displayed
	await dashboard
		.content()
		.table("history/isbn")
		.assertRows([{ committedAt: txn2Date, warehouseName: "Warehouse 1", quantity: 2, noteName: "Note 1" }]);

	// Add a transaction in the past
	const dateStub = await getDateStub(page);
	dateStub.mock(new Date(Date.now() - 2 * TIME_DAY));

	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 2, warehouseId: 1, displayName: "Note -1" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [2, { isbn: "1111111111", quantity: 3, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 2);
	const txn1Date = await (await getDbHandle(page)).evaluate(() => new Date().toISOString().slice(0, 10));

	// Check stock and transactions
	await dashboard
		.content()
		.stockReport()
		.assert([["Warehouse 1", 5]]);

	await dashboard
		.content()
		.table("history/isbn")
		.assertRows([
			{ committedAt: txn1Date, warehouseName: "Warehouse 1", quantity: 3, noteName: "Note -1" },
			{ committedAt: txn2Date, warehouseName: "Warehouse 1", quantity: 2, noteName: "Note 1" }
		]);

	// Add stock to different warehouse
	//
	// Reset the date
	await dateStub.reset();

	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 3, warehouseId: 2, displayName: "Note 2" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [3, { isbn: "1111111111", quantity: 2, warehouseId: 2 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 3);
	const txn3Date = await (await getDbHandle(page)).evaluate(() => new Date().toISOString().slice(0, 10));

	// Check stock and transactions
	await dashboard
		.content()
		.stockReport()
		.assert([
			["Warehouse 1", 5],
			["Warehouse 2", 2]
		]);

	await dashboard
		.content()
		.table("history/isbn")
		.assertRows([
			{ committedAt: txn1Date, warehouseName: "Warehouse 1", quantity: 3, noteName: "Note -1" },
			{ committedAt: txn2Date, warehouseName: "Warehouse 1", quantity: 2, noteName: "Note 1" },
			{ committedAt: txn3Date, warehouseName: "Warehouse 2", quantity: 2, noteName: "Note 2" }
		]);

	// Add one outbound transaction (should reduce warehouse stock)
	//
	// We're stubbing the date to be 2mins into the future (to ensure the txn ordering)
	await dateStub.mock(new Date(Date.now() + 2 * TIME_MIN));

	await (await getDbHandle(page)).evaluate(createOutboundNote, { id: 4, displayName: "Note 3" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [4, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [4, { isbn: "1111111111", quantity: 1, warehouseId: 2 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 4);
	const txn4Date = await (await getDbHandle(page)).evaluate(async () => new Date().toISOString().slice(0, 10));

	await dashboard
		.content()
		.stockReport()
		.assert([
			["Warehouse 1", 3],
			["Warehouse 2", 1]
		]);

	await dashboard
		.content()
		.table("history/isbn")
		.assertRows([
			{ committedAt: txn1Date, warehouseName: "Warehouse 1", quantity: 3, noteName: "Note -1" },
			{ committedAt: txn2Date, warehouseName: "Warehouse 1", quantity: 2, noteName: "Note 1" },
			{ committedAt: txn3Date, warehouseName: "Warehouse 2", quantity: 2, noteName: "Note 2" },
			{ committedAt: txn4Date, warehouseName: "Warehouse 1", quantity: 2, noteName: "Note 3" },
			{ committedAt: txn4Date, warehouseName: "Warehouse 2", quantity: 1, noteName: "Note 3" }
		]);
});

test("history/isbn - navigation", async ({ page }) => {
	const dashboard = getDashboard(page);
	// Instead of `dbHandle` this test uses `(await getDbHandle(page))` so it works after a page reload
	// const dbHandle = await getDbHandle(page);
	const search = dashboard.content().searchField();

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/isbn' subview
	await page.getByRole("link", { name: "By ISBN" }).click();
	await page.waitForURL("**/history/isbn/**/");

	// Navigate to the page for 1111111111
	await search.type("1111111111");
	await search.completions().n(0).click();
	await dashboard.content().header().title().assert("1111111111");

	// Add some trasnactions
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 1);

	// Clickiong on the note name should redirect to the (committed) note page
	await dashboard.content().table("history/isbn").row(0).field("noteName").click();
	await dashboard.content().header().title().assert("Note 1");
});

test("history/notes - base", async ({ page }) => {
	const dashboard = getDashboard(page);

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/notes' subview
	await page.getByRole("link", { name: "Notes by Date" }).click();
	await page.waitForURL("**/history/notes/**/");

	// Should use today as default date
	expect(page.url().includes(new Date().toISOString().slice(0, 10))).toEqual(true);
	// Should display a message stating that no notes are available on today's date
	await dashboard.content().getByText("No notes found").waitFor();
	await dashboard.content().getByText("No notes seem to have been committed on that date").waitFor();
});

test("history/notes - date display", async ({ page }) => {
	const dashboard = getDashboard(page);
	const dbHandle = await getDbHandle(page);
	const dateStub = await getDateStub(page);

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/notes' subview
	await page.getByRole("link", { name: "Notes by Date" }).click();
	await page.waitForURL("**/history/notes/**/");

	// Add some notes to work with
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "2222222222", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	// Should display the note (including price data)
	await dashboard
		.content()
		.entityList("history/notes")
		.assertElements([
			{
				name: `Warehouse 1 / Note 1`,
				totalCoverPrice: 40, // 2*10 + 1*20
				totalDiscountedPrice: 40 // Same as cover price - no discount
			}
		]);

	// Add an outbound note on the same day
	// Stub the date to ensure ordering
	await dateStub.mock(new Date(Date.now() + TIME_MIN));
	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Note 2" });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);
	await dashboard
		.content()
		.entityList("history/notes")
		.assertElements([
			{
				name: `Warehouse 1 / Note 1`,
				totalCoverPrice: 40, // 2*10 + 1*20
				totalDiscountedPrice: 40 // Same as cover price - no discount
			},
			{
				name: `Outbound / Note 2`,
				totalCoverPrice: 10, // 1*10
				totalDiscountedPrice: 10 // Same as cover price - no discount
			}
		]);

	// Add a note to a different warehouse (on the same day)
	await dateStub.mock(new Date(Date.now() + 2 * TIME_MIN));
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 2, displayName: "Note 3" });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "2222222222", quantity: 3, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 3);
	await dashboard
		.content()
		.entityList("history/notes")
		.assertElements([
			{
				name: `Warehouse 1 / Note 1`,
				totalCoverPrice: 40, // 2*10 + 1*20
				totalDiscountedPrice: 40 // Same as cover price - no discount
			},
			{
				name: `Outbound / Note 2`,
				totalCoverPrice: 10, // 2*10 + 1*20
				totalDiscountedPrice: 10 // Same as cover price - no discount
			},
			{
				name: `Warehouse 2 / Note 3`,
				totalCoverPrice: 60, // 3*20
				totalDiscountedPrice: 54 // 60 * 0.9 (10% discount applied)
			}
		]);

	// Add an outbound note, containing transactions from both warehouses (discount applied only to part of txns)
	await dateStub.mock(new Date(Date.now() + 3 * TIME_MIN));
	await dbHandle.evaluate(createOutboundNote, { id: 4, displayName: "Note 4" });
	await dbHandle.evaluate(addVolumesToNote, [4, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [4, { isbn: "2222222222", quantity: 1, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 4);
	await dashboard
		.content()
		.entityList("history/notes")
		.assertElements([
			{
				name: `Warehouse 1 / Note 1`,
				totalCoverPrice: 40, // 2*10 + 1*20
				totalDiscountedPrice: 40 // Same as cover price - no discount
			},
			{
				name: `Outbound / Note 2`,
				totalCoverPrice: 10, // 2*10 + 1*20
				totalDiscountedPrice: 10 // Same as cover price - no discount
			},
			{
				name: `Warehouse 2 / Note 3`,
				totalCoverPrice: 60, // 3*20
				totalDiscountedPrice: 54 // 60 * 0.9 (10% discount applied)
			},
			{
				name: `Outbound / Note 4`,
				totalCoverPrice: 30, // 1*10 + 1*20
				totalDiscountedPrice: 28 // 1*10 (no discount) + 1*20*0.9 (10% discount applied)
			}
		]);

	// Add two notes on a different date
	const twoDaysAgo = new Date(Date.now() - 2 * TIME_DAY).toISOString().slice(0, 10);
	await dateStub.mock(twoDaysAgo);
	await dbHandle.evaluate(createInboundNote, { id: 5, warehouseId: 1, displayName: "Past Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [5, { isbn: "1111111111", quantity: 5, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 5);

	await dateStub.mock(new Date(new Date(twoDaysAgo).getTime() + TIME_MIN));
	await dbHandle.evaluate(createOutboundNote, { id: 6, displayName: "Past Note 2" });
	await dbHandle.evaluate(addVolumesToNote, [6, { isbn: "1111111111", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 6);

	// The list hadn't changed (we're observing today)
	await dashboard
		.content()
		.entityList("history/notes")
		.assertElements([
			{
				name: `Warehouse 1 / Note 1`,
				totalCoverPrice: 40, // 2*10 + 1*20
				totalDiscountedPrice: 40 // Same as cover price - no discount
			},
			{
				name: `Outbound / Note 2`,
				totalCoverPrice: 10, // 2*10 + 1*20
				totalDiscountedPrice: 10 // Same as cover price - no discount
			},
			{
				name: `Warehouse 2 / Note 3`,
				totalCoverPrice: 60, // 3*20
				totalDiscountedPrice: 54 // 60 * 0.9 (10% discount applied)
			},
			{
				name: `Outbound / Note 4`,
				totalCoverPrice: 30, // 1*10 + 1*20
				totalDiscountedPrice: 28 // 1*10 (no discount) + 1*20*0.9 (10% discount applied)
			}
		]);

	// Navigate to two days ago - should display "Past Note 1" and "Past Note 2"
	await dashboard.content().calendar().select(twoDaysAgo);
	await dashboard
		.content()
		.entityList("history/notes")
		.assertElements([
			{
				name: `Warehouse 1 / Past Note 1`,
				totalCoverPrice: 50, // 5*10
				totalDiscountedPrice: 50 // Same as cover price - no discount
			},
			{
				name: `Outbound / Past Note 2`,
				totalCoverPrice: 30, // 3*10
				totalDiscountedPrice: 30 // Same as cover price - no discount
			}
		]);
});

test("history/warehose - base", async ({ page }) => {
	const dashboard = getDashboard(page);

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/warehouse' subview
	await page.getByRole("link", { name: "by Warehouse" }).click();
	await page.waitForURL("**/history/warehouse/**/");

	// The list should show two existing warehouses
	await dashboard
		.content()
		.entityList("warehouse-list")
		.assertElements([
			{
				name: "Warehouse 1",
				discount: 0,
				numBooks: 0
			},
			{
				name: "Warehouse 2",
				discount: 10,
				numBooks: 0
			}
		]);

	// Navigate to the page for Warehouse 1 - should default to toady - today range
	await dashboard.content().entityList("warehouse-list").item(0).getByText("Warehouse 1").click();
	await dashboard.content().getByText("No transactions found").waitFor();
	await dashboard.content().getByText("There seem to be no transactions going in/out for the selected date range").waitFor();
	const today = new Date().toISOString().slice(0, 10);
	expect(page.url().includes(`${today}/${today}`)).toEqual(true);
});

test("history/warehouse - date ranges and filters", async ({ page }) => {
	const dashboard = getDashboard(page);
	const dateStub = await getDateStub(page);
	const dbHandle = await getDbHandle(page);

	const from = dashboard.content().calendar("calendar-from");
	const to = dashboard.content().calendar("calendar-to");

	// Add some transactions to work with (spanning last three days)
	//
	// Two days ago
	const t_minus_2 = new Date(Date.now() - 2 * TIME_DAY).toISOString().slice(0, 10);
	await dateStub.mock(t_minus_2);
	await dbHandle.evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 5, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [1, { isbn: "2222222222", quantity: 5, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 1);

	await dateStub.mock(new Date(new Date(t_minus_2).getTime() + TIME_MIN));
	await dbHandle.evaluate(createOutboundNote, { id: 2, displayName: "Note 2" });
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "1111111111", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [2, { isbn: "2222222222", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 2);

	// Yesterday
	const t_minus_1 = new Date(Date.now() - TIME_DAY).toISOString().slice(0, 10);
	await dateStub.mock(t_minus_1);
	await dbHandle.evaluate(createInboundNote, { id: 3, warehouseId: 1, displayName: "Note 3" });
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "1111111111", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [3, { isbn: "2222222222", quantity: 3, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 3);

	await dateStub.mock(new Date(new Date(t_minus_1).getTime() + TIME_MIN));
	await dbHandle.evaluate(createOutboundNote, { id: 4, displayName: "Note 4" });
	await dbHandle.evaluate(addVolumesToNote, [4, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [4, { isbn: "2222222222", quantity: 2, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 4);

	// Today
	await dateStub.reset();
	await dbHandle.evaluate(createInboundNote, { id: 5, warehouseId: 1, displayName: "Note 5" });
	await dbHandle.evaluate(addVolumesToNote, [5, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [5, { isbn: "2222222222", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(commitNote, 5);
	await dateStub.mock(new Date(Date.now() + TIME_MIN));
	// Note: This is an intruder (Warehouse 2) - this should not be shown in Warehouse 1 view
	//
	// No transactions should be shown
	await dbHandle.evaluate(createInboundNote, { id: 6, warehouseId: 2, displayName: "Note 6" });
	await dbHandle.evaluate(addVolumesToNote, [6, { isbn: "1111111111", quantity: 5, warehouseId: 2 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [6, { isbn: "2222222222", quantity: 5, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 6);

	await dbHandle.evaluate(createOutboundNote, { id: 7, displayName: "Note 7" });
	await dbHandle.evaluate(addVolumesToNote, [7, { isbn: "1111111111", quantity: 1, warehouseId: 1 }] as const);
	await dbHandle.evaluate(addVolumesToNote, [7, { isbn: "2222222222", quantity: 3, warehouseId: 2 }] as const);
	await dbHandle.evaluate(commitNote, 7);

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	// Navigate to 'history/warehouse' subview
	await page.getByRole("link", { name: "by Warehouse" }).click();
	// Navigate to Warehouse 1
	await dashboard.content().entityList("warehouse-list").item(0).getByText("Warehouse 1").click();
	await dashboard.content().header().title().assert("Warehouse 1 history");

	// The default (today) should show only today's transactions
	const today = new Date().toISOString().slice(0, 10);
	await dashboard
		.content()
		.table("history/warehouse")
		.assertRows([
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 5" },
			{ committedAt: today, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 1, noteName: "Note 5" },
			// Note 6 doesn't belong to this warehouse
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 7" }
			// Note 7 - txn 2 won't be shown - belongs to Warehouse 2
		]);

	// Check range yesterday - today
	await from.select(t_minus_1);
	await dashboard
		.content()
		.table("history/warehouse")
		.assertRows([
			// Yesterday
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 3, noteName: "Note 3" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 3, noteName: "Note 3" },
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 2, noteName: "Note 4" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 2, noteName: "Note 4" },

			// Today
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 5" },
			{ committedAt: today, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 1, noteName: "Note 5" },
			// Note 6 doesn't belong to this warehouse
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 7" }
			// Note 7 - txn 2 won't be shown - belongs to Warehouse 2
		]);

	// Check range two days ago - today
	await from.select(t_minus_2);
	await dashboard
		.content()
		.table("history/warehouse")
		.assertRows([
			// Two days ago
			{ committedAt: t_minus_2, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 5, noteName: "Note 1" },
			{ committedAt: t_minus_2, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 5, noteName: "Note 1" },
			{ committedAt: t_minus_2, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 3, noteName: "Note 2" },
			{ committedAt: t_minus_2, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 3, noteName: "Note 2" },

			// Yesterday
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 3, noteName: "Note 3" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 3, noteName: "Note 3" },
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 2, noteName: "Note 4" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 2, noteName: "Note 4" },

			// Today
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 5" },
			{ committedAt: today, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 1, noteName: "Note 5" },
			// Note 6 doesn't belong to this warehouse
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 7" }
			// Note 7 - txn 2 won't be shown - belongs to Warehouse 2
		]);

	// Check range two days ago - yesterday
	await to.select(t_minus_1);
	await dashboard
		.content()
		.table("history/warehouse")
		.assertRows([
			// Two days ago
			{ committedAt: t_minus_2, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 5, noteName: "Note 1" },
			{ committedAt: t_minus_2, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 5, noteName: "Note 1" },
			{ committedAt: t_minus_2, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 3, noteName: "Note 2" },
			{ committedAt: t_minus_2, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 3, noteName: "Note 2" },

			// Yesterday
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 3, noteName: "Note 3" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 3, noteName: "Note 3" },
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 2, noteName: "Note 4" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 2, noteName: "Note 4" }
		]);

	// Test inbound/outbound filters
	//
	// Reset to two days ago - today range
	await to.select(today);

	// The inbound/outbound filter is not implemented on helpers api as it's used only here
	const filter = dashboard.content().header().locator("#inbound-outbound-filter");
	await filter.waitFor();

	// Test for only inbound
	await filter.getByText("Purchase").click();
	await dashboard
		.content()
		.table("history/warehouse")
		.assertRows([
			// Two days ago
			{ committedAt: t_minus_2, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 5, noteName: "Note 1" },
			{ committedAt: t_minus_2, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 5, noteName: "Note 1" },

			// Yesterday
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 3, noteName: "Note 3" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 3, noteName: "Note 3" },

			// Today
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 5" },
			{ committedAt: today, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 1, noteName: "Note 5" }
		]);

	// Test for only outbound
	await filter.getByText("Sale").click();
	await dashboard
		.content()
		.table("history/warehouse")
		.assertRows([
			// Two days ago
			{ committedAt: t_minus_2, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 3, noteName: "Note 2" },
			{ committedAt: t_minus_2, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 3, noteName: "Note 2" },

			// Yesterday
			{ committedAt: t_minus_1, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 2, noteName: "Note 4" },
			{ committedAt: t_minus_1, isbn: "2222222222", title: "Book 2", authors: "Author 2", quantity: 2, noteName: "Note 4" },

			// Today
			{ committedAt: today, isbn: "1111111111", title: "Book 1", authors: "Author 1", quantity: 1, noteName: "Note 7" }
			// Note 7 - txn 2 won't be shown - belongs to Warehouse 2
		]);
});

test("history/warehose - navigation", async ({ page }) => {
	const dashboard = getDashboard(page);
	// Instead of `dbHandle` this test uses `(await getDbHandle(page))` so it works after a page reload
	// const dbHandle = await getDbHandle(page);

	// Navigate to (default) history view
	await page.getByRole("link", { name: "History" }).click();
	await page.waitForURL("**/history/date/**/");
	// Navigate to 'history/warehouse' subview
	await page.getByRole("link", { name: "by Warehouse" }).click();
	await page.waitForURL("**/history/warehouse/**/");

	// Navigate to the page for Warehouse 1 - should default to toady - today range
	await dashboard.content().entityList("warehouse-list").item(0).getByText("Warehouse 1").click();
	await dashboard.content().header().title().assert("Warehouse 1 history");

	// Add a transaction
	await (await getDbHandle(page)).evaluate(createInboundNote, { id: 1, warehouseId: 1, displayName: "Note 1" });
	await (await getDbHandle(page)).evaluate(addVolumesToNote, [1, { isbn: "1111111111", quantity: 2, warehouseId: 1 }] as const);
	await (await getDbHandle(page)).evaluate(commitNote, 1);

	// Clicking on note name should navigate to note page
	await dashboard.content().table("history/warehouse").row(0).field("noteName").click();
	await dashboard.content().header().title().assert("Note 1");
});
