import type { Locator, Page } from "@playwright/test";
import { getDashboard } from "./dashboard";

import type { ViewName, WaitForOpts, MainNavInterface } from "./types";

const viewLinkLookup: Record<ViewName, string> = {
	inbound: "Inbound",
	outbound: "Outbound",
	stock: "Stock"
};

export class MainNav implements MainNavInterface {
	#page: Page;

	container: Locator;

	constructor(page: Page) {
		this.#page = page;

		this.container = page.getByRole("navigation", { name: "Main navigation" });
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}

	link(label: string) {
		return this.container.getByRole("link", { name: label, exact: true });
	}

	async navigate(to: ViewName) {
		const label = viewLinkLookup[to];
		this.container.getByRole("link", { name: label, exact: true }).click();
		await getDashboard(this.#page).view(to).waitFor();
	}
}
