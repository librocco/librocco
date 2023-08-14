import type { Page } from "@playwright/test";

import type { ViewName, MainNavInterface, WaitForOpts } from "./types";

import { assertionTimeout } from "../constants";

import { getDashboard } from "./dashboard";

const viewLinkLookup: Record<ViewName, string> = {
	inbound: "Inbound",
	outbound: "Outbound",
	stock: "Stock"
};

export function getMainNav(page: Page): MainNavInterface {
	const container = page.getByRole("navigation", { name: "Main navigation" });

	const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	const navigate = async (to: ViewName, opts?: WaitForOpts) => {
		const label = viewLinkLookup[to];
		container.getByRole("link", { name: label, exact: true }).click();
		await getDashboard(page)
			.view(to)
			.waitFor({ timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { link, navigate });
}
