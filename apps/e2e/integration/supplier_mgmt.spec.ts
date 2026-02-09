import { expect } from "@playwright/test";

import { appHash } from "@/constants";

import { getDbHandle, upsertBook } from "@/helpers/cr-sqlite";
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
	testOrders("displays split column layout with search functionality", async ({ page, suppliers, books, suppliersWithPublishers }) => {
		depends(books);
		depends(suppliersWithPublishers);

		await page.goto(appHash("suppliers"));
		const dbHandle = await getDbHandle(page);

		await dbHandle.evaluate(upsertBook, { isbn: "978-0-306-40615-7", title: "Book A", author: "Author A", publisher: "Publisher A" });

		await page.goto(appHash("suppliers", suppliers[0].id));
		await page.getByText(suppliers[0].name, { exact: true }).waitFor();

		await page.getByRole("button", { name: "Assigned Publishers" }).click();

		// Check for split column layout - both headings should be visible
		// .nth(1) -- tab button is matched as .nth(0)
		await expect(page.getByText("Assigned Publishers").nth(1)).toBeVisible();
		await expect(page.getByText("Available Publishers")).toBeVisible();

		// Check search bar is present
		const searchInput = page.getByPlaceholder("Search publishers...");
		await expect(searchInput).toBeVisible();

		// Check pub1 is visible (assigned to first supplier)
		await expect(page.getByText("pub1")).toBeVisible();

		// Check Publisher A is visible (unassigned)
		await expect(page.getByText("Publisher A")).toBeVisible();

		// Check pub2 is visible (assigned to other supplier)
		await expect(page.getByText("pub2")).toBeVisible();

		// Test search functionality
		await searchInput.fill("pub1");
		await expect(page.getByText("pub1")).toBeVisible();
		await expect(page.getByText("pub2")).not.toBeVisible();

		// Test clear search button
		await searchInput.clear();
		await expect(page.getByText("pub2")).toBeVisible();

		// Test the UI buttons for adding/removing publishers

		// First, remove Pub1 using the UI button
		await page.getByText("pub1").locator("..").getByRole("button", { name: "Remove" }).click();

		// Wait for page to update and pub2 to be clickable
		await page.waitForTimeout(500);

		// Test reassigning a publisher from another supplier using UI
		await page.getByText("pub2").locator("..").getByRole("button", { name: "Re-assign" }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText(
			`Are you sure you want to remove pub2 from its previous supplier and assign it to ${suppliers[0].name}?`
		);

		await dialog.getByRole("button", { name: "Confirm" }).click();
		await expect(dialog).not.toBeVisible();
	});
});
