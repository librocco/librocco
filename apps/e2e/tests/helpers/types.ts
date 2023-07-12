import type { Locator } from "@playwright/test";

export type WaitForOpts = Parameters<Locator["waitFor"]>[0];

export type ViewName = "inbound" | "outbound" | "stock";

export interface HelperLocator {
	container: Locator;
	waitFor: Locator["waitFor"];
}

export interface DashboardInterface {
	nav(): MainNavInterface;
	navigate(to: ViewName): Promise<ViewInterface>;
	view(name: ViewName): ViewInterface;
	waitFor(opts?: WaitForOpts): Promise<void>;
}

export interface MainNavInterface extends HelperLocator {
	link(label: string, opts?: { active?: boolean }): Locator;
	navigate(to: ViewName): Promise<ViewInterface>;
}

export interface ViewInterface extends HelperLocator {
	sidebar(): SidebarInterface;
}

export interface SidebarInterface extends HelperLocator {
	createWarehouse(): Promise<void>;
	createNote(): Promise<void>;
	assertLinks(labels: string[]): Promise<void>;
	link(label: string): Locator;
	assertGroups(labels: string[]): Promise<void>;
	linkGroup(name: string): SideLinkGroupInterface;
}

export interface SideLinkGroupInterface extends Omit<SidebarInterface, "assertGroups" | "linkGroup" | "createWarehouse"> {
	open(): Promise<void>;
}
