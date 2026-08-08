import { expect } from "@playwright/test";

import { baseURL } from "@/constants";

import { testBase as test } from "@/helpers/fixtures";
import { getDashboard } from "@/helpers/dashboard";

test.beforeEach(async ({ page }) => {
	// Load the app
	await page.goto(baseURL);
	await getDashboard(page).waitFor();
});

test("uses the workstation name set in settings for new note names", async ({ page }) => {
	const dashboard = getDashboard(page);

	// Change the workstation name on the settings page
	await page.getByRole("link", { name: "Settings" }).click();

	const workstationInput = page.locator("input[name='workstationName']");
	await workstationInput.waitFor();
	// Seeded by the e2e storage state (see playwright.config.ts)
	await expect(workstationInput).toHaveValue("Alpha");

	await workstationInput.fill("Front desk");
	const deviceSettingsForm = page.locator("form", { has: page.locator("input[name='workstationName']") });
	await deviceSettingsForm.getByRole("button", { name: "Save and Reload" }).click();

	// A new sale is named after the updated workstation name
	await page.getByRole("link", { name: "Sale" }).click();
	await dashboard.content().header().getByRole("button", { name: "New sale" }).first().click();
	await page.getByRole("heading", { name: "Sale Front desk", exact: true }).first().waitFor();
});
