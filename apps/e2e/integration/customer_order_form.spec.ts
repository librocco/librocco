import { expect } from "@playwright/test";

import { appHash } from "@/constants";

import { testOrders } from "@/helpers/fixtures";

testOrders("general: closes the form 'Cancel' click or 'Esc' press", async ({ page, t }) => {
	const { customer_orders_page: tCustomers } = t;

	await page.goto(appHash("customers"));

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.new_order() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await page.getByRole("button", { name: t.common.actions.cancel() }).click({ force: true });
	await dialog.waitFor({ state: "detached" });

	await page.getByRole("button", { name: tCustomers.labels.new_order() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await page.keyboard.press("Escape");
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer list: new: submits the form with all fields", async ({ page, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));

	const customer = {
		[tForms.customer_order_meta.labels.name()]: "John Doe",
		[tForms.customer_order_meta.labels.email()]: "john@gmail.com",
		[tForms.customer_order_meta.labels.phone1()]: "1234567890",
		[tForms.customer_order_meta.labels.phone2()]: "0987654321",
		[tForms.customer_order_meta.labels.deposit()]: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.new_order() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer list: new: submits the form with only name provided", async ({ page, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));

	const customer = {
		[tForms.customer_order_meta.labels.name()]: "John Doe"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.new_order() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer list: new: doesn't allow for submission without the name field", async ({ page, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));

	// NOTE: filling in non-required fields ensures the focus moves away from the name field (asserted to return back in failed validation)
	const customer = {
		[tForms.customer_order_meta.labels.email()]: "john@gmail.com",
		[tForms.customer_order_meta.labels.deposit()]: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.new_order() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel(tForms.customer_order_meta.labels.name(), { exact: true })).toBeFocused();
});

testOrders("customer list: new: doesn't allow for submission with invalid email field", async ({ page, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));

	const customer = {
		[tForms.customer_order_meta.labels.name()]: "John Doe",
		[tForms.customer_order_meta.labels.email()]: "not-an-email-string",
		[tForms.customer_order_meta.labels.deposit()]: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.new_order() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel(tForms.customer_order_meta.labels.email(), { exact: true })).toBeFocused();
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

testOrders("customer page: update: submits the form with all fields changed", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click();

	const updatedCustomer = {
		[tForms.customer_order_meta.labels.display_id()]: "John's Id",
		[tForms.customer_order_meta.labels.name()]: "John Doe",
		[tForms.customer_order_meta.labels.email()]: "john@gmail.com",
		[tForms.customer_order_meta.labels.deposit()]: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only name updated", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click();

	const updatedCustomer = {
		[tForms.customer_order_meta.labels.name()]: "John Doe (Updated)"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only displayId updated", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click();

	const updatedCustomer = {
		[tForms.customer_order_meta.labels.display_id()]: "John's Id"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only email updated", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click();

	const updatedCustomer = {
		[tForms.customer_order_meta.labels.email()]: "new-email@gmail.com"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: submits the form with only deposit updated", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click();

	const updatedCustomer = {
		[tForms.customer_order_meta.labels.deposit()]: "12"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(updatedCustomer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: doesn't allow for blank name field update", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click();

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	await dialog.getByLabel(tForms.customer_order_meta.labels.name(), { exact: true }).clear();

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click();
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel(tForms.customer_order_meta.labels.name(), { exact: true })).toBeFocused();
});

testOrders("customer page: update: doesn't allow for blank displayId field update", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click({ force: true });

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	await dialog.getByLabel(tForms.customer_order_meta.labels.display_id(), { exact: true }).clear();

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel(tForms.customer_order_meta.labels.display_id(), { exact: true })).toBeFocused();
});

testOrders("customer page: update: doesn't allow for submission with invalid email field", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click();

	const customer = {
		[tForms.customer_order_meta.labels.email()]: "not-an-email-string"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel(tForms.customer_order_meta.labels.email(), { exact: true })).toBeFocused();
});

testOrders("customer page: update: allows updates to customer an email (previously blank)", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;
	// NOTE: This also tests for the returned custoemr data compatibility with the no-email form (should catch incompatible fallbacks and such)

	// NOTE: At the time of this writing, customers[2] doesn't have an assigned email
	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[2].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click({ force: true });

	const customer = {
		[tForms.customer_order_meta.labels.name()]: "Updated Customer Guy (or Girl)"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("customer page: update: allows for blank email string", async ({ page, customers, t }) => {
	const { customer_orders_page: tCustomers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("customers"));
	await page
		.getByRole("table")
		.getByRole("row")
		.filter({ hasText: customers[0].fullname })
		.getByRole("link", { name: tCustomers.labels.edit() })
		.click({ force: true });

	const customer = {
		[tForms.customer_order_meta.labels.email()]: ""
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tCustomers.labels.edit_customer() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText(tCustomers.dialogs.edit_customer.title()).waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: tCustomers.labels.save() }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier order list: new: submits the form with all fields", async ({ page, t }) => {
	const { supplier_orders_page: tSuppliers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("supplier_orders"));

	const customer = {
		[tForms.customer_order_meta.labels.name()]: "John Doe",
		[tForms.customer_order_meta.labels.email()]: "john@gmail.com",
		[tForms.customer_order_meta.labels.phone1()]: "1234567890",
		[tForms.customer_order_meta.labels.phone2()]: "0987654321",
		[tForms.customer_order_meta.labels.deposit()]: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tSuppliers.placeholder.button() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier order list: new: submits the form with only name provided", async ({ page, t }) => {
	const { supplier_orders_page: tSuppliers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("supplier_orders"));

	const customer = {
		[tForms.customer_order_meta.labels.name()]: "John Doe"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tSuppliers.placeholder.button() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier order list: new: doesn't allow for submission without the name field", async ({ page, t }) => {
	const { supplier_orders_page: tSuppliers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("supplier_orders"));

	// NOTE: filling in non-required fields ensures the focus moves away from the name field (asserted to return back in failed validation)
	const customer = {
		[tForms.customer_order_meta.labels.email()]: "john@gmail.com",
		[tForms.customer_order_meta.labels.deposit()]: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tSuppliers.placeholder.button() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel(tForms.customer_order_meta.labels.name(), { exact: true })).toBeFocused();
});

testOrders("supplier order list: new: doesn't allow for submission with invalid email field", async ({ page, t }) => {
	const { supplier_orders_page: tSuppliers } = t;
	const { forms: tForms } = t;

	await page.goto(appHash("supplier_orders"));

	const customer = {
		[tForms.customer_order_meta.labels.name()]: "John Doe",
		[tForms.customer_order_meta.labels.email()]: "not-an-email-string",
		[tForms.customer_order_meta.labels.deposit()]: "10"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: tSuppliers.placeholder.button() }).first().click(); // First as there might be 2 (in case of no customer orders)

	await dialog.getByText("Create new order").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click({ force: true });
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel(tForms.customer_order_meta.labels.email(), { exact: true })).toBeFocused();
});
