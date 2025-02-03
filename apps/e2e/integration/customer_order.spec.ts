import { test, expect } from "@playwright/test";

import { baseURL } from "./constants";
import { getDbHandle } from "@/helpers";
import { addBooksToCustomer, upsertCustomer } from "@/helpers/cr-sqlite";

test.beforeEach(async ({ page }) => {
	await page.goto(`${baseURL}orders/customers/`);
});
test("should create a new customer order", async ({ page }) => {
	await page.getByRole("button", { name: "New Order" }).first().click();

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();

	await page.getByLabel("Name").nth(1).fill("New Customer");
	await page.getByLabel("Email").nth(1).fill("new@example.com");

	await page.getByRole("button", { name: "Create" }).click();

	// Verify new customer appears in list
	await expect(page.getByText("New Customer")).toBeVisible();
	await expect(page.getByText("new@example.com")).toBeVisible();
});

type CustomerTestFixture = {
	customer: { id: number; fullname: string; email: string };
};

const testOrders = test.extend<CustomerTestFixture>({
	customer: async ({ page }, use) => {
		await page.goto(baseURL);

		const customer = { id: 1, fullname: "John Doe", email: "john@gmail.com" };

		const dbHandle = await getDbHandle(page);

		// dbHandler
		await dbHandle.evaluate(upsertCustomer, customer);
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234"] });
		await dbHandle.evaluate(addBooksToCustomer, { customerId: 1, bookIsbns: ["1234", "4321"] });

		await use(customer);
	}
});

testOrders("should show list of In Progress orders", async ({ page, customer }) => {
	await page.goto(`${baseURL}orders/customers/`);
	page.getByRole("button", { name: "In Progress" });

	await expect(page.getByText(customer.fullname)).toBeVisible();
	await expect(page.getByText(customer.email)).toBeVisible();
});
testOrders("should show a customer order with the correct details", async ({ page, customer }) => {
	await page.goto(`${baseURL}orders/customers/`);
	const updateButton = page.getByRole("link", { name: "Update" }).first();
	await updateButton.click();
	await page.waitForURL(`${baseURL}orders/customers/1/`);

	await expect(page.getByText(customer.fullname)).toBeVisible();
	await expect(page.getByText(customer.email)).toBeVisible();

	await expect(page.getByText("1234").first()).toBeVisible();
	await expect(page.getByText("1234").nth(1)).toBeVisible();

	await expect(page.getByText("4321")).toBeVisible();
});
testOrders("should update a customer details", async ({ page, customer }) => {
	await page.goto(`${baseURL}orders/customers/1/`);

	page.getByText(customer.fullname);
	await page.getByLabel("Edit customer order name, email or deposit").click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await page.getByLabel("Name").nth(2).fill("New Customer");
	await page.getByLabel("Email").nth(2).fill("new@gmail.com");

	await page.getByLabel("Deposit").nth(2).fill("10");

	await page.locator('button[type="submit"]').click();

	await expect(page.getByLabel("Edit customer order name, email or deposit").nth(1)).toBeHidden();

	await expect(page.getByText("New Customer")).toBeVisible();
	await expect(page.getByText("new@gmail.com")).toBeVisible();
});

testOrders("should add books to a customer order", async ({ page, customer }) => {
	await page.goto(`${baseURL}orders/customers/`);

	await page.getByRole("link", { name: "Update" }).first().click();

	await page.waitForURL(`${baseURL}orders/customers/1/`);
	await expect(page.getByText(customer.fullname)).toBeVisible();
	await expect(page.getByText(customer.email)).toBeVisible();

	const isbnField = page.getByRole("textbox");
	isbnField.fill("5678");
	isbnField.press("Enter");

	await expect(page.getByText("5678")).toBeVisible();
});
