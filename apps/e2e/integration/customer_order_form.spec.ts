import { expect } from "@playwright/test";

import { appHash } from "@/constants";

import { testOrders } from "@/helpers/fixtures";

testOrders("general: closes the form 'Cancel' click or 'Esc' press", async ({ page }) => {
	await page.goto(appHash("customers"));

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await page.getByRole("button", { name: "Cancel" }).click({ force: true });
	await dialog.waitFor({ state: "detached" });

	await page.getByRole("button", { name: "New Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await page.keyboard.press("Escape");
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer list: new: submits the form with all fields", async ({ page }) => {
	await page.goto(appHash("customers"));

	const customer = {
		Name: "John Doe",
		Email: "john@gmail.com",
		"Phone 1": "1234567890",
		"Phone 2": "0987654321",
		Deposit: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer list: new: submits the form with only name provided", async ({ page }) => {
	await page.goto(appHash("customers"));

	const customer = {
		Name: "John Doe"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer list: new: doesn't allow for submission without the name field", async ({ page }) => {
	await page.goto(appHash("customers"));

	// NOTE: filling in non-required fields ensures the focus moves away from the name field (asserted to return back in failed validation)
	const customer = {
		Email: "john@gmail.com",
		Deposit: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
});

testOrders("customer list: new: doesn't allow for submission with invalid email field", async ({ page }) => {
	await page.goto(appHash("customers"));

	const customer = {
		Name: "John Doe",
		Email: "not-an-email-string",
		Deposit: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
});

testOrders("customer page: update: doesn't submit the form without any changes made", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click({});

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.waitFor();
	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	// Try and submit
	await expect(dialog.getByRole("button", { name: tCustomers.labels.save() })).toBeDisabled();
});

testOrders("customer page: update: submits the form with all fields changed", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("table").getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	const updatedCustomer = {
		"Display ID": "John's Id",
		Name: "John Doe",
		Email: "john@gmail.com",
		Deposit: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only name updated", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("table").getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	const updatedCustomer = {
		Name: "John Doe (Updated)"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only displayId updated", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("table").getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	const updatedCustomer = {
		"Display ID": "John's Id"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only email updated", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("table").getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	const updatedCustomer = {
		Email: "new-email@gmail.com"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only deposit updated", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("table").getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	const updatedCustomer = {
		Deposit: "12"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: doesn't allow for blank name field update", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("table").getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	await dialog.getByLabel("Name", { exact: true }).clear();

	await dialog.getByRole("button", { name: "Save" }).click();
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
});

testOrders("customer page: update: doesn't allow for blank displayId field update", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: "Edit" })
		.click({ force: true });

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	await dialog.getByLabel("Display ID", { exact: true }).clear();

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Display ID", { exact: true })).toBeFocused();
});

testOrders("customer page: update: doesn't allow for submission with invalid email field", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page.getByRole("table").getByRole("row").filter({ hasText: customers[0].fullname }).getByRole("link", { name: "Edit" }).click();

	const customer = {
		Email: "not-an-email-string"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
});

testOrders("customer page: update: allows updates to customer an email (previously blank)", async ({ page, customers }) => {
	// NOTE: This also tests for the returned custoemr data compatibility with the no-email form (should catch incompatible fallbacks and such)

	// NOTE: At the time of this writing, customers[2] doesn't have an assigned email
	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[2].fullname })
		.getByRole("link", { name: "Edit" })
		.click({ force: true });

	const customer = {
		Name: "Updated Customer Guy (or Girl)"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: allows for blank email string", async ({ page, customers }) => {
	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: "Edit" })
		.click({ force: true });

	const customer = {
		Email: ""
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit customer" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Edit customer details").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier order list: new: submits the form with all fields", async ({ page }) => {
	await page.goto(appHash("supplier_orders"));

	const customer = {
		Name: "John Doe",
		Email: "john@gmail.com",
		"Phone 1": "1234567890",
		"Phone 2": "0987654321",
		Deposit: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Customer Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier order list: new: submits the form with only name provided", async ({ page }) => {
	await page.goto(appHash("supplier_orders"));

	const customer = {
		Name: "John Doe"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Customer Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier order list: new: doesn't allow for submission without the name field", async ({ page }) => {
	await page.goto(appHash("supplier_orders"));

	// NOTE: filling in non-required fields ensures the focus moves away from the name field (asserted to return back in failed validation)
	const customer = {
		Email: "john@gmail.com",
		Deposit: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Customer Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
});

testOrders("supplier order list: new: doesn't allow for submission with invalid email field", async ({ page }) => {
	await page.goto(appHash("supplier_orders"));

	const customer = {
		Name: "John Doe",
		Email: "not-an-email-string",
		Deposit: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Customer Order" }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
});
