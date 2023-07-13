import type { Page, Locator } from "@playwright/test";

import type { ViewInterface, ViewName, WaitForOpts } from "./types";

export class View implements ViewInterface {
	container: Locator;

	constructor(page: Page, name: ViewName) {
		this.container = page.locator(`[data-view="${name}"]`);
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}
}
