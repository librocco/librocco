import { test, expect } from "@playwright/test";

import { appPath, base } from "app/lib/paths";
import { testId }_ from "app/lib/utils/tests";

const SUPPLIER_ORDER_ID = "1"; // Placeholder ID

test.describe("Supplier Order Print View", () => {
	test.describe("Button Navigation", () => {
		test("should navigate to the print view from a supplier order page", async ({ page, context }) => {
			// Navigate to an existing supplier order page
			await page.goto(appPath(`/orders/suppliers/orders/${SUPPLIER_ORDER_ID}`));

			// Locate the "Print order" button
			const printButton = page.getByRole("link", { name: "Print order" });
			await expect(printButton).toBeVisible();

			// Click the button and wait for the new tab
			const [newPage] = await Promise.all([
				context.waitForEvent("page"),
				printButton.click()
			]);

			await newPage.waitForLoadState();

			// Assert that the URL of the new tab is correct
			expect(newPage.url()).toBe(`${page.url().split("/orders")[0]}${base}/print/orders/supplier/${SUPPLIER_ORDER_ID}`);

			// Close the new tab
			await newPage.close();

			// Optional: Assert that the original page is still active
			expect(page.url()).toContain(`/orders/suppliers/orders/${SUPPLIER_ORDER_ID}`);
		});
	});

	test.describe("Print View Content", () => {
		test("should display correct content on the supplier order print view page", async ({ page }) => {
			// Directly navigate to a supplier order print view URL
			await page.goto(appPath(`/print/orders/supplier/${SUPPLIER_ORDER_ID}`));

			// Assert that the page title is visible (the print-only H1)
			const pageTitle = page.locator(".print-only-header h1");
			await expect(pageTitle).toBeVisible();
			await expect(pageTitle).toContainText(`Printable Supplier Order`); // Check for partial title

			// Assert that supplier details section is present
			const orderDetailsSection = page.locator("section.order-details");
			await expect(orderDetailsSection).toBeVisible();
			// Example: Check for a label like "Supplier:" - specific content depends on test data
			await expect(orderDetailsSection).toContainText("Supplier:");

			// Assert that the order lines table is present
			const table = page.locator("section.order-lines-table table");
			await expect(table).toBeVisible();
			// Example: Check for at least one row if data is expected
			// await expect(table.locator("tbody tr").first()).toBeVisible();

			// Assert that the "Print this page" button is visible (on screen)
			const printThisPageButton = page.getByRole("button", { name: "Print this page" });
			await expect(printThisPageButton).toBeVisible();
		});
	});
});
