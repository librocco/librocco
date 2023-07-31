import type { Locator, Page } from "@playwright/test";

import type { NavInterface, SidebarInterface, SideLinkGroupInterface, WaitForOpts } from "./types";

import { assertionTimeout } from "../constants";

import { getDashboard } from "./dashboard";

import { compareEntries, useExpandButton } from "./utils";

export function getSidebar(page: Page): SidebarInterface {
	const container = page.getByRole("navigation", { name: "Sidebar" });

	const link = (label: string) => {
		return container.getByRole("link", { name: label, exact: true });
	};

	const createWarehouse = async (opts?: WaitForOpts) => {
		return createEntity(Object.assign(container, { link }), "warehouse", opts);
	};

	const createNote = async (opts?: WaitForOpts) => {
		return createEntity(Object.assign(container, { link }), "note", opts);
	};

	const assertLinks = (labels: string[], opts?: WaitForOpts) => compareEntries(container, labels, "a", opts);

	const assertGroups = (labels: string[], opts?: WaitForOpts) => compareEntries(container, labels, "button", opts);

	const linkGroup = (name: string): SideLinkGroupInterface => getSideLinkGroup(container, name);

	return Object.assign(container, { link, createWarehouse, createNote, assertLinks, assertGroups, linkGroup });
}

function getSideLinkGroup(sidebar: Locator, name: string): SideLinkGroupInterface {
	// Transform group name to a valid id (same logic we're using to assign id to the element)
	const groupId = `nav-group-${name.replaceAll(" ", "_").replaceAll(/[()]/g, "")}`;

	// Get group container (using the id)
	const container = sidebar.locator(`#${groupId}`);

	const link = (label: string) => {
		return container.getByRole("link", { name: label, exact: true });
	};

	const { open } = useExpandButton(container);

	const createNote = async (opts?: WaitForOpts) => {
		await open(opts);
		return createEntity(Object.assign(container, { link }), "note", opts);
	};

	const assertLinks = async (labels: string[], opts?: WaitForOpts) => {
		await open(opts);
		return compareEntries(container, labels, "a", opts);
	};

	return Object.assign(container, { link, open, createNote, assertLinks });
}

async function createEntity(nav: NavInterface, entity: "warehouse" | "note", opts?: WaitForOpts) {
	const content = getDashboard(nav.page()).content();

	// Save the title of the entuty currently open in the content section (if any)
	const currentTitle = await content.heading().getTitle({ timeout: 10 });

	// Create entity (note/warehouse)
	await nav.getByRole("button", { name: `Create ${entity}` }).click();

	// If current title, wait for it to get removed
	if (currentTitle) {
		await content.heading(currentTitle, { exact: true }).waitFor({ state: "detached", timeout: assertionTimeout, ...opts });
	}

	// Wait for the new title to appear in the content section
	const newTitle = await content.heading().getTitle(opts);

	// Wait for the new title to appear in the nav
	await nav.link(newTitle).waitFor({ timeout: assertionTimeout, ...opts });
}
