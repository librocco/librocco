import type { Page } from "@playwright/test";

import { WebClientView } from "@librocco/shared";

import type { DashboardInterface, WaitForOpts } from "./types";

import { assertionTimeout } from "@/constants";

import { getMainNav } from "./navigation";
// import { getSidebar } from "./sidebar";
import { getContent } from "./content";
// import { getBookForm } from "./bookForm";
import { disableNotifications } from "./notifications";

export function getDashboard(page: Page): DashboardInterface {
	// As soon as some view is loaded, we can assume the dashboard is loaded
	const waitFor = (opts?: WaitForOpts) => page.locator('[data-loaded="true"]').waitFor({ timeout: assertionTimeout, ...opts });

	const nav = () => getMainNav(page);

	const navigate = (to: WebClientView) => nav().navigate(to);

	const view = (name: WebClientView) =>
		Object.assign(page.locator(`[data-view="${name}"][data-loaded="true"]`), { dashboard: () => getDashboard(page) });

	// const sidebar = () => getSidebar(page);

	const content = () => getContent(page);

	// const bookForm = () => getBookForm(page);

	// return { waitFor, nav, navigate, view, sidebar, content, bookForm };

	return { page: () => page, nav, navigate, view, content, waitFor, disableNotifications: () => disableNotifications(page) };
}
