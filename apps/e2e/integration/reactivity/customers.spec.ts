import { expect } from "@playwright/test";

import { appHash } from "@/constants";

import { getDbHandle, upsertCustomer } from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";

testOrders("customer list: updates the list as customer orders are added or updated", async ({ page, customers }) => {
	await page.goto(appHash("customers"));

	const dbHandle = await getDbHandle(page);
	const table = page.getByRole("table");

	// NOTE: every customer row has an 'Update' button (way to match them all)
	const customerRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "Update" }) });

	// Wait for the page to load
	await expect(customerRow).toHaveCount(customers.length);

	// Add one more customer order
	const newCustomer = { id: 4, displayId: "4", fullname: "New Customer", email: "cus@email.com" };
	await dbHandle.evaluate(upsertCustomer, newCustomer);

	// Check for new customer
	await expect(customerRow).toHaveCount(customers.length + 1);

	// Validate the row
	const newCustomerRow = customerRow.filter({ hasText: newCustomer.fullname });
	await newCustomerRow.getByText(newCustomer.email).waitFor();
	await newCustomerRow.getByText(newCustomer.displayId).waitFor();

	// Update the row
	await dbHandle.evaluate(upsertCustomer, { ...newCustomer, fullname: "Updated Customer" });
	await customerRow.filter({ hasText: "Updated Customer" }).waitFor();
});

// TODO: test for other cases
