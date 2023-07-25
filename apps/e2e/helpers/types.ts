import type { Locator } from "@playwright/test";

import type { NoteState, NoteTempState } from "@librocco/shared";

export type WaitForOpts = Parameters<Locator["waitFor"]>[0];
export type GetByTextOpts = Parameters<Locator["getByText"]>[1];

export type ViewName = "inbound" | "outbound" | "stock";

/** @TODO Import this from shared (duplicate) */
export interface DisplayRow {
	isbn: string;
	title: string;
	quantity: number;
	warehouseId: string;
	price: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	warehouseName: string;
}

export interface DashboardInterface {
	waitFor: Locator["waitFor"];
	nav(): MainNavInterface;
	navigate(to: ViewName): Promise<void>;
	view(name: ViewName): ViewInterface;
	sidebar(): SidebarInterface;
	content(): ContentInterface;
	bookForm(): BookFormInterface;
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
	scanField(): ScanFieldInterface;
	entries(view: ViewName): EntriesTableInterface;
}

export interface ContentHeadingInterface extends Locator {
	getTitle(opts?: WaitForOpts): Promise<string>;
	rename(newTitle: string): Promise<void>;
}

export interface StatePickerInterface extends Locator {
	getState(): Promise<NoteState | NoteTempState>;
	assertState(state: NoteState | NoteTempState): Promise<void>;
	select(state: NoteState): Promise<void>;
}

export interface ScanFieldInterface extends Locator {
	add(isbn: string): Promise<void>;
	create(): Promise<void>;
}

export interface BookFormValues {
	isbn: string;
	title: string;
	price: number;
	year: string;
	authors: string;
	publisher: string;
	editedBy: string;
	outOfPrint: boolean;
}

export interface BookFormInterface extends Locator {
	field<N extends keyof BookFormValues>(name: N): BookFormFieldInterface<BookFormValues[N]>;
	fillBookData(entries: Partial<BookFormValues>): Promise<void>;
	fillExistingData(): Promise<void>;
	submit(kind?: "keyboard" | "click"): Promise<void>;
}

export interface BookFormFieldInterface<T extends string | number | boolean> extends Locator {
	set: (value: T) => Promise<void>;
}

export interface AssertRowFieldsOpts {
	strict?: boolean;
}

export interface EntriesTableInterface extends Locator {
	row(index: number): EntriesRowInterface;
	assertRows(rows: Partial<DisplayRow>[], opts?: AssertRowFieldsOpts): Promise<void>;
	selectAll(): Promise<void>;
	unselectAll(): Promise<void>;
	deleteSelected(): Promise<void>;
}

export interface EntriesRowInterface extends Locator {
	assertField<K extends keyof DisplayRow>(name: K, value: DisplayRow[K]): Promise<void>;
	assertFields(row: Partial<DisplayRow>, opts?: AssertRowFieldsOpts): Promise<void>;
	setQuantity(value: number): Promise<void>;
	select(): Promise<void>;
	unselect(): Promise<void>;
}
