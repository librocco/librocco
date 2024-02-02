import { WebClientView } from "@librocco/shared";

import type { DashboardNode, MainNavInterface, WaitForOpts } from "./types";

import { assertionTimeout } from "@/constants";

export function getMainNav(parent: DashboardNode): MainNavInterface {
	const dashboard = parent.dashboard;
	const container = dashboard().page().getByRole("navigation", { name: "Main navigation" });

	// const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	const navigate = async (to: WebClientView, opts?: WaitForOpts) => {
		// TODO: There's probably a better way to do this: Ideally, we would go through the links, hover them and
		// see which tooltip is displayed (testing full UX)
		await container.locator(`[data-linkto="${to}"]`).click();
		await dashboard()
			.view(to)
			.waitFor({ timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { navigate, dashboard });
}
