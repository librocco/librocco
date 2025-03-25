import { expect } from "@playwright/test";

import { baseURL } from "../constants";

import { getDbHandle, upsertCustomer } from "@/helpers/cr-sqlite";
import { depends, testOrders } from "@/helpers/fixtures";

testOrders("customer list: updates the list as customer orders are added or updated", async ({ page, customers }) => {
	await page.goto(`${baseURL}orders/customers/`);

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

testOrders("customer list: updates the list as customer orders get completed", async ({ page, customers, customerOrderLines }) => {
	// TODO: remove this when we silence the no-unused-vars rule
	depends(customerOrderLines);

	await page.goto(`${baseURL}orders/customers/`);

	const dbHandle = await getDbHandle(page);
	const table = page.getByRole("table");

	// NOTE: every customer row has an 'Update' button (way to match them all)
	const customerRow = table.getByRole("row").filter({ has: page.getByRole("link", { name: "Update" }) });

	// Wait for the page to load
	await expect(customerRow).toHaveCount(customers.length);

	// Mark customers[0]'s lines as collected
	//
	// Using explicit SQL to do this -- not the most future proof way, but cost/benefit said this is the way to go
	// (considering potential changes we'd need to make just for this one test)
	await dbHandle.evaluate(
		(db, c1Id) => db.exec("UPDATE customer_order_lines SET collected = ? WHERE customer_id = ?", [Date.now(), c1Id]),
		customers[0].id
	);

	// Verify
	await expect(customerRow).toHaveCount(customers.length - 1);
	await customerRow.filter({ hasText: customers[0].fullname }).waitFor({ state: "detached" });

	// Move to 'Completed' tab and check
	await page.getByRole("button", { name: "Completed", exact: true }).click();

	// TODO: this matched matches customer order rows by having 'Update' button (see above) which should probably change in the future
	await expect(customerRow).toHaveCount(1);
	await customerRow.getByText(customers[0].fullname).waitFor();
});

// TODO: test for other cases
