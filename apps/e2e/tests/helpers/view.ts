import type { Page, Locator } from "@playwright/test";

import type { ViewInterface, ViewName, WaitForOpts, DashboardInterface, SidebarInterface } from "./types";

import { Sidebar } from "./sidebar";

export class View implements ViewInterface {
	#page: Page;
	#dashboard: DashboardInterface;

	container: Locator;

	constructor(page: Page, dashboard: DashboardInterface, name: ViewName) {
		this.#page = page;
		this.#dashboard = dashboard;

		this.container = page.locator(`[data-view="${name}"]`);
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}

	sidebar(): SidebarInterface {
		return new Sidebar(this.#page, this);
	}
}
