import type { Page } from "@playwright/test";

import type { DashboardInterface, ViewName } from "./types";

import { getMainNav } from "./navigation";
// import { getSidebar } from "./sidebar";
// import { getContent } from "./content";
// import { getBookForm } from "./bookForm";

export function getDashboard(page: Page): DashboardInterface {
	const nav = () => getMainNav(page);

	const navigate = (to: ViewName) => nav().navigate(to);

	// const view = (name: ViewName) => page.locator(`[data-view="${name}"]`);

	// const sidebar = () => getSidebar(page);

	// const content = () => getContent(page);

	// const bookForm = () => getBookForm(page);

	// The dashboard is ready (as well as the app when the default warehouse is loaded - shown in the side nav)
	// const waitFor = (opts?: WaitForOpts) => sidebar().link("All").waitFor(opts);

	// return { waitFor, nav, navigate, view, sidebar, content, bookForm };

	return { nav, navigate };
}
