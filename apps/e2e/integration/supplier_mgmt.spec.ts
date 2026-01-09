import { expect } from "@playwright/test";

import { appHash } from "@/constants";

import { getDbHandle, associatePublisher, removePublisherFromSupplier, upsertBook } from "@/helpers/cr-sqlite";
import { depends, testOrders } from "@/helpers/fixtures";

testOrders.describe("The supplier list view", () => {
	testOrders("should show empty state when no suppliers exist", async ({ page, t }) => {
		const { suppliers_page: tSuppliers } = t;

		await page.goto(appHash("suppliers"));

		await expect(page.getByRole("table")).not.toBeVisible();
		await expect(page.getByText(tSuppliers.placeholder.title())).toBeVisible();
		await expect(page.getByText(tSuppliers.placeholder.description())).toBeVisible();

		// There is a button in the top right of the view, but we target the one in the placeholder box
		await page.getByRole("button", { name: tSuppliers.labels.new_supplier() }).nth(1).click();

		await expect(page.getByRole("dialog")).toBeVisible();
	});

	testOrders("should allow navigation to an individual supplier view", async ({ page, t, suppliers }) => {
		depends(suppliers);

		// TODO: this needs to be renamed when working on the page
		const { order_list_page: tSupplier } = t;

		await page.goto(appHash("suppliers"));

		// Can navigate view the edit link
		// nth(1) ignores header row
		await page.getByRole("table").getByRole("row").nth(1).getByRole("link", { name: "Edit" }).click();

		// TODO: also needs to be updated
		await expect(page.getByRole("heading", { level: 1, name: tSupplier.details.supplier_page() })).toBeVisible();

		await page.goto(appHash("suppliers"));

		// Or clicking the row
		await page.getByRole("table").getByRole("row").nth(1).click();

		// TODO: also needs to be updated
		await expect(page.getByRole("heading", { level: 1, name: tSupplier.details.supplier_page() })).toBeVisible();
	});
});

testOrders.describe("Supplier publisher config", () => {
	testOrders("displays three different lists of publishers correctly", async ({ page, suppliers, books, suppliersWithPublishers }) => {
		depends(books);
		depends(suppliersWithPublishers);

		await page.goto(appHash("suppliers"));
		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(upsertBook, { isbn: "978-0-306-40615-7", title: "Book A", author: "Author A", publisher: "Publisher A" });

		await page.goto(appHash("supplier_orders", suppliers[0].id));
		await page.goto(appHash("suppliers"));

		await page.getByText(suppliers[0].name, { exact: true }).waitFor();
		await page.getByRole("table").getByRole("row").filter({ hasText: suppliers[0].name }).getByText("Edit").click();
		// Wait for the page to load
		await page.getByText(suppliers[0].name, { exact: true }).waitFor();

		// Check the assigned publishers list
		const assignedPublishersTable = page.locator("table").nth(0);
		await expect(assignedPublishersTable.getByText("pub1")).toBeVisible();
		// await expect(assignedPublishersTable.getByText("pub2")).toBeVisible();

		// Check the unassigned publishers list
		const unassignedPublishersTable = page.locator("table").nth(1);

		await expect(unassignedPublishersTable.getByText("Publisher A")).toBeVisible();

		// Check the publishers assigned to other suppliers list
		const otherSuppliersPublishersTable = page.locator("table").nth(2);
		await expect(otherSuppliersPublishersTable.getByText("pub2")).toBeVisible();

		// Test reactivity: remove a publisher from suppliers[0]
		const dbHandle2 = await getDbHandle(page);
		await dbHandle2.evaluate(removePublisherFromSupplier, { supplierId: suppliers[0].id, publisher: "Publisher A" });

		// Publisher A should now be in the unassigned list
		await expect(assignedPublishersTable.getByText("Publisher A")).not.toBeVisible();
		await expect(unassignedPublishersTable.getByText("Publisher A")).toBeVisible();

		// Test reactivity: assign a previously unassigned publisher to suppliers[0]
		await dbHandle2.evaluate(associatePublisher, { supplierId: suppliers[0].id, publisher: "Publisher D" });

		// Publisher D should now be in the assigned list
		await expect(assignedPublishersTable.getByText("Publisher D")).toBeVisible();
		await expect(unassignedPublishersTable.getByText("Publisher D")).not.toBeVisible();

		// Test reactivity: assign a publisher from another supplier to suppliers[0]
		await dbHandle2.evaluate(associatePublisher, { supplierId: suppliers[0].id, publisher: "Publisher B" });

		// Publisher B should now be in the assigned list and not in the other suppliers
		// list
		await expect(assignedPublishersTable.getByText("Publisher B")).toBeVisible();
		await expect(otherSuppliersPublishersTable.getByText("Publisher B")).not.toBeVisible();

		// Test the UI buttons for adding/removing publishers

		// First, remove Publisher1 using the UI button
		await assignedPublishersTable.getByRole("row").filter({ hasText: "pub1" }).getByRole("button", { name: "Remove publisher" }).click();

		// Publisher1 should now be in the unassigned list
		await expect(assignedPublishersTable.getByText("pub1")).not.toBeVisible();
		await expect(unassignedPublishersTable.getByText("pub1")).toBeVisible();

		// Now add Publisher E using the UI button
		await otherSuppliersPublishersTable
			.getByRole("row")
			.filter({ hasText: "pub2" })
			.getByRole("button", { name: "Re-assign to supplier" })
			.click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText(
			`Are you sure you want to remove pub2 from its previous supplier and assign it to ${suppliers[0].name}?`
		);

		await dialog.getByRole("button", { name: "Confirm" }).click();
		await expect(dialog).not.toBeVisible();

		// Publisher E should now be in the assigned list
		await expect(assignedPublishersTable.getByText("pub2")).toBeVisible();
		await expect(unassignedPublishersTable.getByText("pub2")).not.toBeVisible();
	});
});
