import { baseURL } from "./constants";
import { test, expect } from "@playwright/test";
import { associatePublisher, removePublisherFromSupplier, upsertBook, upsertSupplier } from "@/helpers/cr-sqlite";
import { testOrders } from "@/helpers/fixtures";
import { getDbHandle } from "@/helpers";

test.describe("Supplier publisher lists", () => {
	testOrders("displays three different lists of publishers correctly", async ({ page, suppliers, books, suppliersWithPublishers }) => {
		await page.goto(`${baseURL}`);

		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(upsertBook, { isbn: "978-0-306-40615-7", title: "Book A", author: "Author A", publisher: "Publisher A" });

		await page.goto(`${baseURL}orders/suppliers/${suppliers[0].id}/`);
		// Wait for the page to load
		await page.getByText(suppliers[0].name, { exact: true }).waitFor();

		// Get the three publisher list tables
		const tables = await page.locator("table").all();
		expect(tables.length).toBeGreaterThanOrEqual(3);

		// Check the assigned publishers list
		const assignedPublishersTable = tables[0];
		await expect(assignedPublishersTable.getByText("pub1")).toBeVisible();
		// await expect(assignedPublishersTable.getByText("pub2")).toBeVisible();

		// Check the unassigned publishers list
		const unassignedPublishersTable = tables[1];

		await expect(unassignedPublishersTable.getByText("Publisher A")).toBeVisible();

		// Check the publishers assigned to other suppliers list
		const otherSuppliersPublishersTable = tables[2];
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
			.getByRole("button", { name: "Add to supplier" })
			.click();

		// Publisher E should now be in the assigned list
		await expect(assignedPublishersTable.getByText("pub2")).toBeVisible();
		await expect(unassignedPublishersTable.getByText("pub2")).not.toBeVisible();
	});
});
