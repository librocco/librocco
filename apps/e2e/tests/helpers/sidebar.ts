import type { Locator, Page } from "@playwright/test";

import type { SidebarInterface, SideLinkGroupInterface, ViewInterface, WaitForOpts } from "./types";

import { compareEntries } from "./utils";

export class Sidebar implements SidebarInterface {
	#page: Page;
	#view: ViewInterface;

	container: Locator;

	constructor(page: Page, view: ViewInterface) {
		this.#page = page;
		this.#view = view;

		this.container = page.getByRole("navigation", { name: "Sidebar" });
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}

	createWarehouse() {
		return this.container.getByRole("button", { name: "Create warehouse" }).click();
	}

	createNote() {
		return this.container.getByRole("button", { name: "Create note" }).click();
	}

	assertLinks(labels: string[]) {
		return compareEntries(this.container, labels, "a");
	}

	link(label: string) {
		return this.container.getByRole("link", { name: label, exact: true });
	}

	assertGroups(labels: string[]) {
		return compareEntries(this.container, labels, "button");
	}

	linkGroup(name: string): SideLinkGroupInterface {
		return new SideLinkGroup(this.#page, this, name);
	}
}

class SideLinkGroup implements SideLinkGroupInterface {
	#page: Page;
	#sidebar: SidebarInterface;

	container: Locator;

	#groupId: string;
	#expandButton: Locator;

	constructor(page: Page, sidebar: SidebarInterface, name: string) {
		this.#page = page;
		this.#sidebar = sidebar;

		// Transform group name to a valid id (same logic we're using to assign id to the element)
		this.#groupId = `nav-group-${name.replaceAll(" ", "_").replaceAll(/[()]/g, "")}`;

		// Get group container (using the id)
		this.container = sidebar.container.locator(`#${this.#groupId}`);

		// Expand button will have the "group name" as its label
		this.#expandButton = this.container.getByRole("button", { name });
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}

	// When the group is expanded, the expand button will have an aria attribute "aria-expanded" set to "true"
	async isExpanded() {
		const expanded = await this.#expandButton.getAttribute("aria-expanded");
		return expanded === "true";
	}

	async open() {
		const expanded = await this.isExpanded();
		if (expanded) {
			return;
		}
		await this.#expandButton.click();
		// Wait for the group to expand (the group will have an expand button at all times, if expanded it will have at least two)
		await this.#page.waitForFunction((groupId) => document.getElementById(groupId).children.length > 1, this.#groupId);
	}

	async createNote() {
		await this.open();
		return this.container.getByRole("button", { name: "Create note" }).click();
	}

	async assertLinks(labels: string[]) {
		await this.open();
		return compareEntries(this.container, labels, "a");
	}

	link(label: string) {
		return this.container.getByRole("link", { name: label, exact: true });
	}
}
