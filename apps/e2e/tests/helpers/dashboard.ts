import type { Page } from "@playwright/test";

import type { DashboardInterface, MainNavInterface, ViewInterface, ViewName, WaitForOpts } from "./types";

import { MainNav } from "./navigation";
import { View } from "./view";
import { getSidebar } from "tests/utils";

export function getDashboard(page: Page) {
	return new Dashboard(page);
}

class Dashboard implements DashboardInterface {
	#page: Page;

	constructor(page: Page) {
		this.#page = page;
	}

	nav(): MainNavInterface {
		return new MainNav(this.#page, this);
	}

	navigate(to: ViewName) {
		return this.nav().navigate(to);
	}

	view(name: ViewName): ViewInterface {
		return new View(this.#page, this, name);
	}

	// The dashboard is ready (as well as the app when the default warehouse is loaded - shown in the side nav)
	waitFor(opts?: WaitForOpts) {
		return getSidebar(this.#page).link("All").waitFor();
	}
}
