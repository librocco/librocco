import type { Page, Locator } from "@playwright/test";

import type { ViewInterface, ViewName, WaitForOpts, DashboardInterface } from "./types";

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
}
