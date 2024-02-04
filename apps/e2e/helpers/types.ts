/* eslint-disable @typescript-eslint/ban-types */
import type { Locator, Page } from "@playwright/test";

import type { NoteState, NoteTempState, EntityListView, WebClientView } from "@librocco/shared";

/** A util type used to "pick" a subset of the given (union type) */
export type Subset<T, S extends T> = S;

export type WaitForOpts = Parameters<Locator["waitFor"]>[0];
export type GetByTextOpts = Parameters<Locator["getByText"]>[1];
/** A type of display row property names, without 'warehouseId' as it's never displayed */
export type TransactionRowField = keyof Omit<DisplayRow, "warehouseId">;

export type DashboardNode<T = {}> = T &
	Locator & {
		dashboard: () => DashboardInterface;
	};

export interface Asserter<T> {
	assert(value: T, opts?: WaitForOpts): Promise<void>;
}

interface Setter<T> {
	set: (value: T) => Promise<void>;
}

type AsserterSetter<T> = Asserter<T> & Setter<T>;

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

export interface DashboardInterface extends Locator {
	page(): Page;
	dashboard(): DashboardInterface;
	nav(): MainNavInterface;
	navigate(to: WebClientView, opts?: WaitForOpts): Promise<void>;
	view(name: WebClientView): ViewInterface;
	content(): ContentInterface;
	dialog(): DialogInterface;
}

export interface NavInterface extends Locator {
	link(label: string, opts?: { active?: boolean }): Locator;
}

export type DialogInterface = DashboardNode<{
	cancel(): Promise<void>;
	confirm(): Promise<void>;
}>;

export type MainNavInterface = DashboardNode<{
	navigate(to: WebClientView): Promise<void>;
}>;

export type ViewInterface = DashboardNode;

export interface SidebarInterface extends Locator {
	createWarehouse(opts?: WaitForOpts): Promise<void>;
	createNote(opts?: WaitForOpts): Promise<void>;
	assertLinks(labels: string[], opts?: WaitForOpts): Promise<void>;
	link(label: string): Locator;
	assertGroups(labels: string[], opts?: WaitForOpts): Promise<void>;
	linkGroup(name: string): SideLinkGroupInterface;
}

export interface SideLinkGroupInterface extends Omit<SidebarInterface, "assertGroups" | "linkGroup" | "createWarehouse"> {
	open(): Promise<void>;
	assertOpen(): Promise<void>;
	assertClosed(): Promise<void>;
}

// #region entityList
export interface EntityListMatcher {
	name?: string;
	updatedAt?: Date;
	numBooks?: number;
	discount?: number;
}

export type WarehouseItemDropdown = DashboardNode<{
	edit: () => Promise<void>;
	viewStock: () => Promise<void>;
	delete: () => Promise<void>;
}>;

export type EntityListItem = DashboardNode<{
	edit(): Promise<void>;
	delete(): Promise<void>;
	dropdown(): WarehouseItemDropdown;
}>;

export type EntityListInterface = DashboardNode<{
	assertElement(element: null, nth: number): Promise<void>;
	assertElement(element: EntityListMatcher, nth?: number): Promise<void>;
	assertElements(elements: EntityListMatcher[]): Promise<void>;
	item(nth: number): EntityListItem;
}>;
// #endregion entityList

export type ContentInterface = DashboardNode<{
	header(): ContentHeaderInterface;
	entityList(view: EntityListView): EntityListInterface;
	// updatedAt(opts?: WaitForOpts): Promise<Date>;
	// assertUpdatedAt(date: Date, opts?: WaitForOpts & { precision: number }): Promise<void>;
	// discount(): WarehouseDiscountInterface;
	// statePicker(): StatePickerInterface;
	// scanField(): ScanFieldInterface;
	// entries(view: WebClientView): EntriesTableInterface;
}>;

export type BreadcrumbsInterface = Asserter<string[]> & DashboardNode;

export type UpdatedAtInterface = Asserter<Date | string> &
	DashboardNode<{
		value(opts?: WaitForOpts): Promise<Date>;
	}>;

export type ContentHeaderInterface = DashboardNode<{
	title: () => Asserter<string>;
	createNote(): Promise<void>;
	createWarehouse(): Promise<void>;
	breadcrumbs(): BreadcrumbsInterface;
	updatedAt(): UpdatedAtInterface;
}>;

// export interface ContentHeadingInterface extends Locator {
// 	getTitle(opts?: WaitForOpts): Promise<string>;
// 	textInput(): Locator;
// 	rename(newTitle: string, opts?: WaitForOpts): Promise<void>;
// }

export interface StatePickerInterface extends Locator {
	getState(opts?: WaitForOpts): Promise<NoteState | NoteTempState>;
	assertState(state: NoteState | NoteTempState, opts?: WaitForOpts): Promise<void>;
	select(state: NoteState): Promise<void>;
}

export interface ScanFieldInterface extends Locator {
	add(isbn: string): Promise<void>;
}

export interface WarehouseDiscountInterface extends Locator {
	set(value: number): Promise<void>;
}

// #region book form
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
// #endregion book form

// #region inventory table
export interface AssertRowFieldsOpts {
	strict?: boolean;
	timeout?: number;
}

export interface EntriesTableInterface extends Locator {
	row(index: number): EntriesRowInterface;
	assertRows(rows: Partial<DisplayRow>[], opts?: AssertRowFieldsOpts): Promise<void>;
	selectAll(): Promise<void>;
	unselectAll(): Promise<void>;
	deleteSelected(): Promise<void>;
}

export interface EntriesRowInterface extends Locator {
	field<K extends keyof TransactionFieldInterfaceLookup>(name: K): TransactionFieldInterfaceLookup[K];
	assertFields(row: Partial<DisplayRow>, opts?: AssertRowFieldsOpts): Promise<void>;
	select(): Promise<void>;
	unselect(): Promise<void>;
}

export type TransactionRowValues = {
	[K in keyof TransactionFieldInterfaceLookup]: DisplayRow[K];
};

export interface WarehouseNameTransactionField extends AsserterSetter<string>, Locator {
	assertOptions(options: string[], opts?: WaitForOpts): Promise<void>;
}

export interface TransactionFieldInterfaceLookup {
	isbn: Asserter<string>;
	title: Asserter<string>;
	authors: Asserter<string>;
	quantity: AsserterSetter<number>;
	year: Asserter<string>;
	publisher: Asserter<string>;
	price: Asserter<number>;
	warehouseName: WarehouseNameTransactionField;
	editedBy: Asserter<string>;
	outOfPrint: Asserter<boolean>;
}
export type GenericTransactionField = keyof Omit<TransactionFieldInterfaceLookup, "quantity" | "warehouseName">;
// #endregion inventory table
