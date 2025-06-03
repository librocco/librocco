import { test, expect } from "@playwright/test";

import { appPath, base } from "app/lib/paths";
import { testId }_ from "app/lib/utils/tests";

const ARCHIVED_NOTE_ID = "1"; // Placeholder ID

test.describe("Archived/Past Note Print View", () => {
	test.describe("Button Navigation", () => {
		test("should navigate to the print view from an archived note page", async ({ page, context }) => {
			// Navigate to an existing archived note page
			await page.goto(appPath(`/history/notes/archive/${ARCHIVED_NOTE_ID}`));

			// Locate the "Print Note" button
			const printButton = page.getByRole("link", { name: "Print Note" });
			await expect(printButton).toBeVisible();

			// Click the button and wait for the new tab
			const [newPage] = await Promise.all([
				context.waitForEvent("page"), // In Playwright, new tabs are also 'page' events from the context
				printButton.click()
			]);

			await newPage.waitForLoadState();

			// Assert that the URL of the new tab is correct
			expect(newPage.url()).toBe(`${page.url().split("/history")[0]}${base}/print/notes/${ARCHIVED_NOTE_ID}`);


			// Close the new tab
			await newPage.close();

			// Optional: Assert that the original page is still active and has the correct URL
			expect(page.url()).toContain(`/history/notes/archive/${ARCHIVED_NOTE_ID}`);
		});
	});

	test.describe("Print View Content", () => {
		test("should display correct content on the print view page", async ({ page }) => {
			// Directly navigate to a print view URL
			await page.goto(appPath(`/print/notes/${ARCHIVED_NOTE_ID}`));

			// Assert that the page title is visible
			// The H1 is now in a .print-only-header div, so we look for that specific H1
			const pageTitle = page.locator(".print-only-header h1");
			await expect(pageTitle).toBeVisible();
			await expect(pageTitle).toContainText(`Printable Note`); // Check for partial title, ID might vary

			// Assert that some key elements are present
			const table = page.getByRole("table");
			await expect(table).toBeVisible();

			// Example: Look for expected text content within the table (adjust selectors based on actual content)
			// This assumes there's at least one row and it contains some text.
			// Specific text will depend on test data for note ID 1.
			await expect(table.locator("tbody tr").first()).toContainText("Book"); // Or "Custom Item"
			await expect(table.locator("tbody tr").first().getByRole("cell").nth(1)).not.toBeEmpty(); // Name/Title column

			// Assert that the "Print this page" button is visible (on screen, hidden by CSS for actual printing)
			const printThisPageButton = page.getByRole("button", { name: "Print this page" });
			await expect(printThisPageButton).toBeVisible();
		});
	});
});
