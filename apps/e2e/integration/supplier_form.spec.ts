import { expect } from "@playwright/test";

import { baseURL } from "@/constants";

import { testOrders } from "@/helpers/fixtures";

testOrders("general: closes the form 'Cancel' click or 'Esc' press", async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Supplier" }).click();

	await page.getByRole("button", { name: "Cancel" }).click();
	await dialog.waitFor({ state: "detached" });

	await page.getByRole("button", { name: "New Supplier" }).click();

	await page.keyboard.press("Escape");
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier list: new: submits the form with all fields", async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);

	const supplier = {
		Name: "Supplier and Co.",
		Email: "info@supplier.co",
		Address: "123 Fake St"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Supplier" }).click();

	await dialog.getByText("Create new supplier").waitFor();

	for (const [key, value] of Object.entries(supplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click();

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a supplier is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier list: new: submits the form with only name provided", async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);

	const supplier = {
		Name: "Supplier and Co."
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Supplier" }).click();

	await dialog.getByText("Create new supplier").waitFor();

	for (const [key, value] of Object.entries(supplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click();

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a supplier is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier list: new: doesn't allow for submission without the name field", async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);

	// NOTE: filling in non-required fields ensures the focus moves away from the name field (asserted to return back in failed validation)
	const supplier = {
		Email: "info@suppliers.co"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Supplier" }).click();

	await dialog.getByText("Create new supplier").waitFor();

	for (const [key, value] of Object.entries(supplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click();
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
});

testOrders("supplier list: new: doesn't allow for submission with invalid email field", async ({ page }) => {
	await page.goto(`${baseURL}orders/suppliers/`);

	const supplier = {
		Name: "John Doe",
		Email: "not-an-email-string"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "New Supplier" }).click();

	await dialog.getByText("Create new supplier").waitFor();

	for (const [key, value] of Object.entries(supplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Create" }).click();
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
});

testOrders("supplier page: update: doesn't submit the form without any changes made", async ({ page, suppliers }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("link", { name: "Edit" }).click();

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.waitFor();
	await dialog.getByText("Update supplier details").waitFor();

	// Try and submit
	await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
});

testOrders("supplier page: update: submits the form with all fields changed", async ({ page, suppliers }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("link", { name: "Edit" }).click();

	const updatedSupplier = {
		Name: "John Doe",
		Email: "info@suppliers.co"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.getByText("Update supplier details").waitFor();

	for (const [key, value] of Object.entries(updatedSupplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click();

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a supplier is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier page: update: submits the form with only name updated", async ({ page, suppliers }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("link", { name: "Edit" }).click();

	const updatedSupplier = {
		Name: "John Doe (Updated)"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.getByText("Update supplier details").waitFor();

	for (const [key, value] of Object.entries(updatedSupplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click();

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a supplier is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier page: update: submits the form with only email updated", async ({ page, suppliers }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("link", { name: "Edit" }).click();

	const updatedSupplier = {
		Email: "new-email@gmail.com"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.getByText("Update supplier details").waitFor();

	for (const [key, value] of Object.entries(updatedSupplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click();

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a supplier is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier page: update: doesn't allow for blank name field update", async ({ page, suppliers }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("link", { name: "Edit" }).click();

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.getByText("Update supplier details").waitFor();

	await dialog.getByLabel("Name", { exact: true }).clear();

	await dialog.getByRole("button", { name: "Save" }).click();
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
});

testOrders("supplier page: update: doesn't allow for submission with invalid email field", async ({ page, suppliers }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("link", { name: "Edit" }).click();

	const supplier = {
		Email: "not-an-email-string"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.getByText("Update supplier details").waitFor();

	for (const [key, value] of Object.entries(supplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click();
	// Focusing of the field indicates this field failed validation
	await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
});

testOrders("supplier page: update: allows updates to a supplier without an email (previously blank)", async ({ page, suppliers }) => {
	// NOTE: This also tests for the returned supplier data compatibility with the no-email form (should catch incompatible fallbacks and such)

	// NOTE: At the time of this writing, suppliers[1] doesn't have an assigned email
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[1].name }).getByRole("link", { name: "Edit" }).click();

	const customer = {
		Name: "Supplier and Sons"
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.getByText("Update supplier details").waitFor();

	for (const [key, value] of Object.entries(customer)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click();

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a customer is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});

testOrders("supplier page: update: allows for blank email string", async ({ page, suppliers }) => {
	await page.goto(`${baseURL}orders/suppliers/`);
	await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByRole("link", { name: "Edit" }).click();

	const supplier = {
		Email: ""
	};

	const dialog = page.getByRole("dialog");

	await page.getByRole("button", { name: "Edit supplier" }).click();

	await dialog.getByText("Update supplier details").waitFor();

	for (const [key, value] of Object.entries(supplier)) {
		await dialog.getByLabel(key, { exact: true }).fill(value);
	}

	await dialog.getByRole("button", { name: "Save" }).click();

	// At this point we're validating the form was closed and considering it a good enough
	// indicator of all fields having been validated (the impact of saving a supplier is tested elsewhere)
	await dialog.waitFor({ state: "detached" });
});
