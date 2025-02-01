import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDashboard, getDbHandle } from "@/helpers";
import { addBooksToCustomer, upsertCustomer } from "@/helpers/cr-sqlite";

test.beforeEach(async ({ page }) => {
	await page.goto(baseURL);
	await getDashboard(page).waitFor();

	page.getByLabel("Main navigation");
	page.getByRole("listitem").nth(5).click();
	const nav = page.getByLabel("Main navigation");
	await nav.waitFor();

	const dbHandle = await getDbHandle(page);
	await dbHandle.evaluate(upsertCustomer, { id: 1, fullname: "John Doe", email: "john@example.com" });
	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234"] });
	await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234", "4321"] });
});

test("should show list of In Progress orders", async ({ page }) => {
	page.getByRole("button", { name: "In Progress" });

	// Verify customer data is displayed
	await expect(page.getByText("John Doe")).toBeVisible();
	await expect(page.getByText("john@example.com")).toBeVisible();
});
test("should create a new customer order", async ({ page }) => {
	await page.getByRole("button", { name: "New Order" }).click();

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();

	await page.getByLabel("Full Name").fill("New Customer");
	await page.getByLabel("Email").fill("new@example.com");

	await page.getByRole("button", { name: "Create" }).click();

	// Verify new customer appears in list
	await expect(page.getByText("New Customer")).toBeVisible();
	await expect(page.getByText("new@example.com")).toBeVisible();
});
test("should show a customer order with the correct details", async ({ page }) => {
	const updateButton = page.getByRole("link", { name: "Update" }).first();
	await updateButton.click();

	expect(page.url()).toContain("/orders/customers/1");

	// Verify customer details are shown
	await expect(page.getByText("John Doe")).toBeVisible();
	await expect(page.getByText("john@example.com")).toBeVisible();

	// Verify order books are listed
	await expect(page.getByText("1234")).toBeVisible();
	await expect(page.getByText("4321")).toBeVisible();
});
test("should update a customer details", async ({ page }) => {
	page.getByLabel("Edit customer order name, email or deposit").click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await page.getByLabel("Full Name").fill("New Customer");
	await page.getByLabel("Email").fill("new@example.com");

	await page.getByRole("button", { name: "Update" }).click();

	await expect(dialog).toBeHidden();

	await expect(page.getByText("New Customer")).toBeVisible();
	await expect(page.getByText("new@example.com")).toBeVisible();
});
test("should add books to a customer order", async ({ page }) => {
	await page.getByRole("link", { name: "Update" }).first().click();

	// Wait for order page
	expect(page.url()).toContain("/orders/customers/1");

	// or  placeholder="Enter ISBN of delivered books"

	const isbnField = page.getByLabel("Enter ISBN of delivered books");
	isbnField.fill("1234");
	isbnField.press("Enter");

	isbnField.fill("5678");
	isbnField.press("Enter");

	await expect(page.getByText("5678")).toBeVisible();
});
