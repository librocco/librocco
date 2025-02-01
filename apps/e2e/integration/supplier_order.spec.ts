import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDashboard, getDbHandle } from "@/helpers";
import {
	addBooksToCustomer,
	associatePublisher,
	upsertCustomer,
	upsertSupplier,
	createSupplierOrder,
	upsertBook
} from "@/helpers/cr-sqlite";
import { BookEntry } from "@librocco/db";

test.beforeEach(async ({ page }) => {
	await page.goto(baseURL);
	await getDashboard(page).waitFor();

	page.getByLabel("Main navigation");
	page.getByRole("listitem").last().click();
	const nav = page.getByLabel("Main navigation");
	await nav.waitFor();

	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, fullname: "fadwa" });

	const books: BookEntry[] = [
		{ isbn: "1111111111", title: "Book 1", authors: "Author 1", publisher: "Publisher 1", year: "2021", price: 10 },
		{ isbn: "2222222222", title: "Book 2", authors: "Author 2", publisher: "Publisher 2", year: "2022", price: 20 }
	];
	await dbHandle.evaluate(upsertBook, books[0]);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1111111111"] });
	await dbHandle.evaluate(upsertSupplier, {
		id: 11,
		name: "sup1"
	});

	await dbHandle.evaluate(associatePublisher, { publisherId: "111", supplierId: 11 });
	await dbHandle.evaluate(createSupplierOrder, [
		{
			supplier_id: 11,
			supplier_name: "sup1",
			isbn: "1111111111",
			title: "Book 1",
			authors: "Author 1",
			publisher: "Publisher 1",
			quantity: 1,
			line_price: 10
		}
	]);

	// Debug: Log the page state
	console.log("Page URL:", page.url());
	await page.reload();
});

test("should show list of In Progress orders", async ({ page }) => {
	// expect(page.getByText("New Order").first()).toBeVisible();
	page.getByLabel("Main navigation").waitFor();

	await getDashboard(page).waitFor();

	page.getByLabel("Main navigation");

	page.getByRole("listitem").last().click();
	console.log("Page URL:", page.url());

	expect(page.getByText("sup1")).toBeVisible();
});
