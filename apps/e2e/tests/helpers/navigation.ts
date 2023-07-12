import type { Locator, Page } from "@playwright/test";

import type { ViewName, WaitForOpts, MainNavInterface, DashboardInterface } from "./types";

const viewLinkLookup: Record<ViewName, string> = {
	inbound: "Inbound",
	outbound: "Outbound",
	stock: "Stock"
};

export class MainNav implements MainNavInterface {
	#page: Page;
	#dashboard: DashboardInterface;

	container: Locator;

	constructor(page: Page, dashboard: DashboardInterface) {
		this.#page = page;
		this.#dashboard = dashboard;

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
		const nextView = this.#dashboard.view(to);
		await nextView.waitFor();
		return nextView;
	}
}
