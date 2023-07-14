import type { Locator } from "@playwright/test";

import type { NoteState } from "@librocco/shared";

export type WaitForOpts = Parameters<Locator["waitFor"]>[0];
export type GetByTextOpts = Parameters<Locator["getByText"]>[1];

export type ViewName = "inbound" | "outbound" | "stock";

export interface DashboardInterface {
	waitFor: Locator["waitFor"];
	nav(): MainNavInterface;
	navigate(to: ViewName): Promise<void>;
	view(name: ViewName): ViewInterface;
	sidebar(): SidebarInterface;
	content(): ContentInterface;
}

export interface NavInterface extends Locator {
	link(label: string, opts?: { active?: boolean }): Locator;
}

export interface MainNavInterface extends Locator {
	navigate(to: ViewName): Promise<void>;
}

export type ViewInterface = Locator;

export interface SidebarInterface extends Locator {
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

export interface ContentInterface extends Locator {
	heading(title?: string, opts?: GetByTextOpts): ContentHeadingInterface;
	updatedAt(): Promise<Date>;
	assertUpdatedAt(date: Date): Promise<void>;
	statePicker(): StatePickerInterface;
}

export interface ContentHeadingInterface extends Locator {
	getTitle(opts?: WaitForOpts): Promise<string>;
	rename(newTitle: string): Promise<void>;
}

export interface StatePickerInterface extends Locator {
	getState(): Promise<NoteState>;
	assertState(state: NoteState): Promise<void>;
	select(state: NoteState): Promise<void>;
}
