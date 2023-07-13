import type { Page } from "@playwright/test";

import type {
	ContentInterface,
	DashboardInterface,
	MainNavInterface,
	SidebarInterface,
	ViewInterface,
	ViewName,
	WaitForOpts
} from "./types";

import { MainNav } from "./navigation";
import { View } from "./view";
import { Sidebar } from "./sidebar";
import { Content } from "./content";

import { getSidebar } from "../utils";

export function getDashboard(page: Page) {
	return new Dashboard(page);
}

class Dashboard implements DashboardInterface {
	#page: Page;

	constructor(page: Page) {
		this.#page = page;
	}

	nav(): MainNavInterface {
		return new MainNav(this.#page);
	}

	navigate(to: ViewName) {
		return this.nav().navigate(to);
	}

	view(name: ViewName): ViewInterface {
		return new View(this.#page, name);
	}

	// The dashboard is ready (as well as the app when the default warehouse is loaded - shown in the side nav)
	waitFor(opts?: WaitForOpts) {
		return getSidebar(this.#page).link("All").waitFor(opts);
	}

	sidebar(): SidebarInterface {
		return new Sidebar(this.#page);
	}

	content(): ContentInterface {
		return new Content(this.#page);
	}
}
