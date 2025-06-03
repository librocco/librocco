import { test, expect } from "@playwright/test";

import { appPath, base } from "app/lib/paths";
import { testId }_ from "app/lib/utils/tests";

const TEST_DATE = "2023-01-01"; // Placeholder date

test.describe("Open Notes (Daily Summary) Print View", () => {
	test.describe("Button Navigation", () => {
		test("should navigate to the print view from the daily notes page", async ({ page, context }) => {
			// Navigate to the daily notes page
			await page.goto(appPath(`/history/notes/date/${TEST_DATE}`));

			// Locate the "Print All Notes for this Date" button
			const printButton = page.getByRole("link", { name: "Print All Notes for this Date" });
			await expect(printButton).toBeVisible();

			// Click the button and wait for the new tab
			const [newPage] = await Promise.all([
				context.waitForEvent("page"),
				printButton.click()
			]);

			await newPage.waitForLoadState();

			// Assert that the URL of the new tab is correct
			expect(newPage.url()).toBe(`${page.url().split("/history")[0]}${base}/print/notes/open/${TEST_DATE}`);

			// Close the new tab
			await newPage.close();

			// Optional: Assert that the original page is still active
			expect(page.url()).toContain(`/history/notes/date/${TEST_DATE}`);
		});
	});

	test.describe("Print View Content", () => {
		test("should display correct content on the daily summary print view page", async ({ page }) => {
			// Directly navigate to a daily summary print view URL
			await page.goto(appPath(`/print/notes/open/${TEST_DATE}`));

			// Assert that the page title is visible
			// The H1 is inside header.no-print, which is hidden.
			// The main content has <h1>Printable Daily Notes Summary - {date}</h1>
			// but this is also inside header.no-print.
			// The actual visible title in print is the <title> tag, and sections start with <h2>
			// For this test, we can check the <title> tag in the <head>
			await expect(page).toHaveTitle(`Printable Daily Summary - ${TEST_DATE}`);

			// Check for the on-screen h1 that's part of the hidden header for non-print
			const screenH1 = page.locator("header.no-print h1");
			await expect(screenH1).toContainText(`Printable Daily Notes Summary - ${TEST_DATE}`);
			await expect(screenH1).toBeHidden({ timeout: 100 }); // Check it's hidden in non-print context by CSS

			// Assert that details for at least one note section are displayed
			// This assumes test data exists for the given date.
			const noteSection = page.locator(".note-section").first();
			await expect(noteSection).toBeVisible();
			await expect(noteSection.getByRole("heading", { level: 2 })).toContainText("Note:"); // e.g., "Note: Some Display Name"

			// Assert that a table of items for that note exists
			const table = noteSection.getByRole("table");
			await expect(table).toBeVisible();
			await expect(table.locator("tbody tr").first()).toBeVisible(); // Check for at least one item row

			// Assert that the "Print this page" button is visible (on screen)
			const printThisPageButton = page.getByRole("button", { name: "Print this page" });
			await expect(printThisPageButton).toBeVisible();
		});
	});
});
