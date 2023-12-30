import type { Page } from "@playwright/test";

import type { ViewName, MainNavInterface, WaitForOpts } from "./types";

// import { assertionTimeout } from "@/constants";

// import { getDashboard } from "./dashboard";

const viewLabelLookup: Record<ViewName, string> = {
	search: "Stock",
	inventory: "Manage inventory",
	outbound: "Outbound",
	settings: "Settings"
};

export function getMainNav(page: Page): MainNavInterface {
	const container = page.getByRole("navigation", { name: "Main navigation" });

	// const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	const navigate = async (to: ViewName, opts?: WaitForOpts) => {
		const label = viewLabelLookup[to];
		// TODO: There's probably a better way to do this: Ideally, we would go through the links, hover them and
		// see which tooltip is displayed (testing full UX)
		await container.locator(`[data-linkfor="${label}"]`).click();
		// await getDashboard(page)
		//	.view(to)
		//	.waitFor({ timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { navigate });
}
