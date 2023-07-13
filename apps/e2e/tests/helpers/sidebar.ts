import type { Locator, Page } from "@playwright/test";

import type { NavInterface, SidebarInterface, SideLinkGroupInterface, WaitForOpts } from "./types";

import { getDashboard } from "./dashboard";
import { compareEntries } from "./utils";

export function getSidebar(page: Page): SidebarInterface {
	const container = page.getByRole("navigation", { name: "Sidebar" });

	const link = (label: string) => {
		return container.getByRole("link", { name: label, exact: true });
	};

	const createWarehouse = async () => {
		return createEntity(Object.assign(container, { link }), "warehouse");
	};

	const createNote = async () => {
		return createEntity(Object.assign(container, { link }), "note");
	};

	const assertLinks = (labels: string[]) => compareEntries(container, labels, "a");

	const assertGroups = (labels: string[]) => compareEntries(container, labels, "button");

	const linkGroup = (name: string): SideLinkGroupInterface => getSideLinkGroup(page, container, name);

	return Object.assign(container, { link, createWarehouse, createNote, assertLinks, assertGroups, linkGroup });
}

function getSideLinkGroup(page: Page, sidebar: Locator, name: string): SideLinkGroupInterface {
	// Transform group name to a valid id (same logic we're using to assign id to the element)
	const groupId = `nav-group-${name.replaceAll(" ", "_").replaceAll(/[()]/g, "")}`;

	// Get group container (using the id)
	const container = sidebar.locator(`#${groupId}`);

	// Expand button will have the "group name" as its label
	const expandButton = container.getByRole("button", { name });

	const link = (label: string) => {
		return container.getByRole("link", { name: label, exact: true });
	};

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
		await page.waitForFunction((groupId) => document.getElementById(groupId).children.length > 1, groupId);
	};

	const createNote = async () => {
		await open();
		return createEntity(Object.assign(container, { link }), "note");
	};

	const assertLinks = async (labels: string[]) => {
		await open();
		return compareEntries(container, labels, "a");
	};

	return Object.assign(container, { link, isExpanded, open, createNote, assertLinks });
}

async function createEntity(nav: NavInterface, entity: "warehouse" | "note") {
	const content = getDashboard(nav.page()).content();

	// Save the title of the entuty currently open in the content section (if any)
	const currentTitle = await content.heading().getTitle({ timeout: 10 });

	// Create entity (note/warehouse)
	await nav.getByRole("button", { name: `Create ${entity}` }).click();

	// If current title, wait for it to get removed
	if (currentTitle) {
		await content.heading(currentTitle, { exact: true }).waitFor({ state: "detached" });
	}

	// Wait for the new title to appear in the content section
	const newTitle = await content.heading().getTitle();

	// Wait for the new title to appear in the nav
	await nav.link(newTitle).waitFor();
}
