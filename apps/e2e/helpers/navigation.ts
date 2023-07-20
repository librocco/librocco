import type { Page } from "@playwright/test";

import type { ViewName, MainNavInterface } from "./types";

import { getDashboard } from "./dashboard";

const viewLinkLookup: Record<ViewName, string> = {
	inbound: "Inbound",
	outbound: "Outbound",
	stock: "Stock"
};

export function getMainNav(page: Page): MainNavInterface {
	const container = page.getByRole("navigation", { name: "Main navigation" });

	const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	const navigate = async (to: ViewName) => {
		const label = viewLinkLookup[to];
		container.getByRole("link", { name: label, exact: true }).click();
		await getDashboard(page).view(to).waitFor();
	};

	return Object.assign(container, { link, navigate });
}
