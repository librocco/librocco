import type { Page } from "@playwright/test";

import { WebClientView } from "@librocco/shared";

import type { MainNavInterface, WaitForOpts } from "./types";

import { assertionTimeout } from "@/constants";

import { getDashboard } from "./dashboard";

export function getMainNav(page: Page): MainNavInterface {
	const container = page.getByRole("navigation", { name: "Main navigation" });

	// const link = (label: string) => container.getByRole("link", { name: label, exact: true });

	const navigate = async (to: WebClientView, opts?: WaitForOpts) => {
		// TODO: There's probably a better way to do this: Ideally, we would go through the links, hover them and
		// see which tooltip is displayed (testing full UX)
		await container.locator(`[data-linkto="${to}"]`).click();
		await getDashboard(page)
			.view(to)
			.waitFor({ timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { navigate });
}
