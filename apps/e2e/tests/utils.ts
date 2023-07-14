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
	assertGroups: (labels: string[]) => Promise<void>;
	linkGroup: (name: string) => LinkGroup;
}

export function getSidebar(page: Page): SideNav {
	const container = page.getByRole("navigation", { name: "Sidebar" });

	const waitFor = () => container.waitFor();

	const createWarehouse = () => container.getByRole("button", { name: "Create warehouse" }).click();
	const createNote = () => container.getByRole("button", { name: "Create note" }).click();

	const assertLinks = (labels: string[]) => compareEntries(container, labels, "a");

	const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	const assertGroups = (labels: string[]) => compareEntries(container, labels, "button");

	const linkGroup = (name: string) => getLinkGroup(page, container, name);

	return {
		container,
		waitFor,
		createNote,
		createWarehouse,
		assertLinks,
		link,
		assertGroups,
		linkGroup
	};
}

interface LinkGroup extends Omit<SideNav, "assertGroups" | "linkGroup" | "createWarehouse"> {
	open: () => Promise<void>;
}

export function getLinkGroup(page: Page, sidebar: Locator, name: string): LinkGroup {
	// Transform group name to a valid id (same logic we're using to assign id to the element)
	const groupId = `nav-group-${name.replaceAll(" ", "_").replaceAll(/[()]/g, "")}`;

	// Get group container (using the id)
	const container = sidebar.locator(`#${groupId}`);

	const waitFor = () => container.waitFor();

	// Expand button will have the "group name" as its label
	const expandButton = container.getByRole("button", { name });

	// When the group is expanded, the expand button will have an aria attribute "aria-expanded" set to "true"
	const isExpanded = async () => {
		const expanded = await expandButton.getAttribute("aria-expanded");
		return expanded === "true";
	};

	const open = async () => {
		const expanded = await isExpanded();
		if (expanded) {
			return;
		}
		await expandButton.click();
		// Wait for the group to expand (the group will have an expand button at all times, if expanded it will have at least two)
		page.waitForFunction((groupId) => document.getElementById(groupId).children.length > 1, groupId);
	};

	const createNote = async () => {
		await open();
		return container.getByRole("button", { name: "Create note" }).click();
	};

	const assertLinks = async (labels: string[]) => {
		await open();
		return compareEntries(container, labels, "a");
	};

	const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	return {
		container,
		open,
		createNote,
		assertLinks,
		waitFor,
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
		await expect(link).toHaveText(label);
	}
}
// #endregion helpers
