import { expect, type Locator, type Page } from "@playwright/test";

import { zip } from "@librocco/shared";

/** A utility function that clicks on the 'Create warehouse' button specified number of times (creating a new warehouse each time) */
export async function createDefaultWarehouses(page: Page, count: number) {
	for (let i = 0; i < count; i++) {
		await page.getByRole("button", { name: "Create warehouse" }).click();
		// We wait for the created warehouse's title to become available as a (h2) heading before creating the next one.
		await page.getByRole("heading", { name: i ? `New Warehouse (${i + 1})` : "New Warehouse" }).waitFor();
	}
}

export function getNoteStatePicker(page: Page) {
	return page.locator("#note-state-picker");
}

interface SideNav {
	container: Locator;
	waitFor: () => Promise<void>;
	createWarehouse: () => Promise<void>;
	createNote: () => Promise<void>;
	assertLinks: (labels: string[]) => Promise<void>;
	link: (label: string) => Locator;
}

export function getSidebar(page: Page): SideNav {
	const container = page.getByRole("navigation", { name: "Sidebar" });

	const waitFor = () => container.waitFor();

	const createWarehouse = () => container.getByRole("button", { name: "Create warehouse" }).click();
	const createNote = () => container.getByRole("button", { name: "Create note" }).click();

	const assertLinks = (labels: string[]) => compareEntries(container, labels, "a");

	const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	return {
		container,
		waitFor,
		createNote,
		createWarehouse,
		assertLinks,
		link
	};
}

/**
 *
 */
export async function renameEntity(page: Page, newName: string) {
	// Click the editable title (the "p" element is clickable in TextEditable)
	await page.locator("#table-section").getByRole("heading").locator("p").click();

	// Wait for the TextEditable to become an input
	const input = page.locator("#table-section").getByRole("heading").getByRole("textbox");
	await input.waitFor();

	// Fill in the new name and submit
	await input.clear();
	await input.fill(newName);
	await input.press("Enter");

	// Wait for the navigation to show the update (signaling the update made the async round trip)
	await page.getByRole("navigation").getByRole("link", { name: newName }).waitFor();
}

// #region helpers
async function compareEntries(container: Locator, labels: string[], selector: string) {
	const elements = await container.locator(selector).all();

	expect(elements.length).toBe(labels.length);

	if (elements.length === 0) {
		return;
	}

	for (const [link, label] of zip(elements, labels)) {
		expect(link).toHaveText(label);
	}
}
// #endregion helpers
