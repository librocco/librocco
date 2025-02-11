import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";

import { testOrders } from "@/helpers/fixtures";
import { getDbHandle } from "@/helpers";
import { addBooksToCustomer, getCustomerOrderLineStatus } from "@/helpers/cr-sqlite";

test("should create a new customer order", async ({ page }) => {
	await page.goto(`${baseURL}orders/customers/`);
	await page.getByRole("button", { name: "New Order" }).first().click();

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();

	await page.getByLabel("Name").nth(1).fill("New Customer");
	await page.getByLabel("Email").nth(1).fill("new@example.com");

	await page.getByRole("button", { name: "Create" }).click();

	await page.waitForURL(`${baseURL}orders/customers/**`);
	// Verify new customer appears in list
	await expect(page.getByText("New Customer")).toBeVisible();
	await expect(page.getByText("new@example.com")).toBeVisible();
});

testOrders("should show list of In Progress orders", async ({ page, customer }) => {
	await page.goto(`${baseURL}orders/customers/`);
	page.getByRole("button", { name: "In Progress" });

	await expect(page.getByText(customer.fullname)).toBeVisible();
	await expect(page.getByText(customer.email)).toBeVisible();
});
testOrders("should allow navigation to a specific order", async ({ page, customer, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn] });
	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });
	await page.goto(`${baseURL}orders/customers/`);
	const updateButton = page.getByRole("link", { name: "Update" }).first();
	await updateButton.click();
	await page.waitForURL(`${baseURL}orders/customers/1/`);

	await expect(page.getByText(customer.fullname)).toBeVisible();
	await expect(page.getByText(customer.email)).toBeVisible();

	await expect(page.getByText(books[0].isbn).first()).toBeVisible();
	await expect(page.getByText(books[0].title).first()).toBeVisible();
	await expect(page.getByText(books[0].authors).first()).toBeVisible();
	await expect(page.getByText(`${books[0].price}`).first()).toBeVisible();
	await expect(page.getByText(books[0].isbn).nth(1)).toBeVisible();
	await expect(page.getByText(books[0].isbn).nth(1)).toBeVisible();
	await expect(page.getByText(books[0].title).nth(1)).toBeVisible();
	await expect(page.getByText(books[0].authors).nth(1)).toBeVisible();
	await expect(page.getByText(`${books[0].price}`).nth(1)).toBeVisible();

	await expect(page.getByText(books[1].isbn)).toBeVisible();
});
testOrders("should update a customer details", async ({ page, customer }) => {
	await page.goto(`${baseURL}orders/customers/1/`);

	const newCustomer = { fullname: "New Customer", email: "new@gmail.com", deposit: "10" };
	await expect(page.getByText(customer.fullname)).toBeVisible();
	await expect(page.getByText(customer.email)).toBeVisible();

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
	await expect(page.getByText(newCustomer.deposit)).toBeVisible();
});

testOrders("should add books to a customer order", async ({ page, customer, books }) => {
	await page.goto(`${baseURL}orders/customers/1/`);

	await expect(page.getByText(customer.fullname)).toBeVisible();
	await expect(page.getByText(customer.email)).toBeVisible();

	const isbnField = page.getByRole("textbox");
	isbnField.fill(books[0].isbn);
	isbnField.press("Enter");

	await expect(page.getByText(books[0].isbn)).toBeVisible();
	await expect(page.getByText(books[0].title)).toBeVisible();
	await expect(page.getByText(books[0].authors)).toBeVisible();
	await expect(page.getByText("Draft")).toBeVisible();

	isbnField.fill("5678");
	isbnField.press("Enter");

	await expect(page.getByText("5678")).toBeVisible();
	await expect(page.getByText("N/A").first()).toBeVisible();
	await expect(page.getByText("N/A").nth(1)).toBeVisible();
	await expect(page.getByText("0", { exact: true })).toBeVisible();
	await expect(page.getByText("Draft").nth(1)).toBeVisible();
});
testOrders("should delete books from a customer order", async ({ page, books }) => {
	const dbHandle = await getDbHandle(page);

	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: [books[0].isbn, books[1].isbn] });

	await page.goto(`${baseURL}orders/customers/1/`);

	await expect(page.getByText(books[0].isbn).first()).toBeVisible();
	await expect(page.getByText(books[1].isbn).first()).toBeVisible();

	await page.getByRole("button", { name: "Delete" }).first().click();

	await expect(page.getByText(books[0].isbn)).not.toBeVisible();
});
testOrders("should mark order lines as collected", async ({ page, customer, customerOrderLines }) => {
	await page.goto(`${baseURL}orders/customers/1/`);
	const dbHandle = await getDbHandle(page);

	const table = page.getByRole("table");
	const firstBookRow = table.getByRole("row").nth(1);
	const secondBookRow = table.getByRole("row").nth(2);

	await expect(firstBookRow.getByRole("cell", { name: customerOrderLines[0].isbn })).toBeVisible();
	await expect(firstBookRow.getByRole("button", { name: "Collect📚" })).toBeEnabled();
	await expect(secondBookRow.getByRole("button", { name: "Collect📚" })).toBeDisabled();

	await firstBookRow.getByRole("button", { name: "Collect📚" }).click();

	const lines = await dbHandle.evaluate(getCustomerOrderLineStatus, customer.id);

	const received = new Date(lines[0].received).toLocaleDateString();
	await expect(firstBookRow.getByRole("button", { name: "Collect📚" })).not.toBeVisible();
	await expect(firstBookRow.getByText("Collected")).toBeVisible();
	await expect(firstBookRow.getByText(received)).toBeVisible();
});
