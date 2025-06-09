import { expect } from "@playwright/test";

import { appHash } from "@/constants";

import { testBase as test, testOrders } from "@/helpers/fixtures";
import { getDbHandle } from "@/helpers";
import { addBooksToCustomer } from "@/helpers/cr-sqlite";

test("should create a new customer order", async ({ page }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("button", { name: "New Order" }).first().click();

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();

	await page.getByLabel("Name").nth(1).fill("New Customer");
	await page.getByLabel("Email").nth(1).fill("new@example.com");

	await page.getByRole("button", { name: "Create" }).click();

	await page.waitForURL(appHash("customers", "**"));
	// Verify new customer appears in list
	await expect(page.getByText("New Customer")).toBeVisible();
	await expect(page.getByText("new@example.com")).toBeVisible();
});

testOrders("should show list of In Progress orders", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	page.getByRole("button", { name: "In Progress" });

	await expect(page.getByText(customers[0].fullname)).toBeVisible();
	await expect(page.getByText(customers[0].email)).toBeVisible();
});

testOrders("should allow navigation to a specific order", async ({ page, customers, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn] });
	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });
	await page.goto(appHash("customers"));
	const updateButton = page.getByRole("link", { name: "Update" }).first();
	await updateButton.click();
	await page.waitForURL(appHash("customers", "1"));

	await expect(page.getByText(customers[0].fullname)).toBeVisible();
	await expect(page.getByText(customers[0].email)).toBeVisible();

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	const secondRow = table.getByRole("row").nth(2);
	const thirdRow = table.getByRole("row").nth(3);

	await expect(firstRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].title })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].authors })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: `${books[0].price}` })).toBeVisible();

	await expect(secondRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[0].title })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[0].authors })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: `${books[0].price}` })).toBeVisible();

	await expect(thirdRow.getByRole("cell", { name: books[1].isbn })).toBeVisible();
});

testOrders("should update a customer details", async ({ page, customers }) => {
	await page.goto(appHash("customers", "1"));

	const newCustomer = { fullname: "New Customer", email: "new@gmail.com", deposit: "10" };
	await expect(page.getByText(customers[0].fullname)).toBeVisible();
	await expect(page.getByText(customers[0].email)).toBeVisible();

	await page.getByLabel("Edit customer order name, email or deposit").click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();

	await page.getByLabel("Name").nth(2).fill(newCustomer.fullname);
	await page.getByLabel("Email").nth(2).fill(newCustomer.email);
	await page.getByLabel("Deposit").nth(2).fill(newCustomer.deposit);

	await page.locator('button[type="submit"]').click();

	await expect(page.getByLabel("Edit customer order name, email or deposit").nth(1)).toBeHidden();

	await expect(page.getByText(newCustomer.fullname)).toBeVisible();
	await expect(page.getByText(newCustomer.email)).toBeVisible();
	await expect(page.getByText(`€${newCustomer.deposit} deposit`)).toBeVisible();
});

testOrders("should add books to a customer order", async ({ page, customers, books }) => {
	await page.goto(appHash("customers", "1"));

	await expect(page.getByText(customers[0].fullname)).toBeVisible();
	await expect(page.getByText(customers[0].email)).toBeVisible();

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	const secondRow = table.getByRole("row").nth(2);

	const isbnField = page.getByRole("textbox");
	isbnField.fill(books[0].isbn);
	isbnField.press("Enter");

	await expect(firstRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].title })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: books[0].authors })).toBeVisible();
	await expect(firstRow.getByRole("cell", { name: "Pending" })).toBeVisible();

	isbnField.fill(books[2].isbn);
	isbnField.press("Enter");

	await expect(secondRow.getByRole("cell", { name: books[2].isbn })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[2].title })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[2].authors })).toBeVisible();

	await expect(secondRow.getByRole("cell", { name: `${books[2].price}`, exact: true })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: "Pending" })).toBeVisible();
});

testOrders("should delete books from a customer order", async ({ page, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });

	await page.goto(appHash("customers", "1"));

	const table = page.getByRole("table");
	const firstRow = table.getByRole("row").nth(1);
	const secondRow = table.getByRole("row").nth(2);

	await expect(firstRow.getByRole("cell", { name: books[0].isbn })).toBeVisible();
	await expect(secondRow.getByRole("cell", { name: books[1].isbn })).toBeVisible();

	await firstRow.getByTestId("popover-control").click();
	await expect(page.getByTestId("delete-row")).toBeVisible();
	await page.getByTestId("delete-row").click();

	await expect(firstRow.getByRole("cell", { name: books[0].isbn })).not.toBeVisible();
});

testOrders("should mark order lines as collected", async ({ page, collectCustomerOrderLine: customerOrderLines }) => {
	await page.goto(appHash("customers", "1"));

	const table = page.getByRole("table");
	const firstBookRow = table.getByRole("row").nth(1);
	const secondBookRow = table.getByRole("row").nth(2);

	await expect(firstBookRow.getByRole("cell", { name: customerOrderLines[0].isbn })).toBeVisible();

	await firstBookRow.getByTestId("popover-control").click();
	await expect(page.getByTestId("collect-row")).toBeVisible();
	await page.getByTestId("collect-row").click();
	await firstBookRow.getByTestId("popover-control").click();
	await expect(page.getByTestId("collect-row")).not.toBeVisible();
	await expect(firstBookRow.getByText("Collected")).toBeVisible();

	await secondBookRow.getByTestId("popover-control").click();
	await expect(page.getByTestId("collect-row")).not.toBeVisible();
});
