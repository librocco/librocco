/* eslint-disable @typescript-eslint/ban-types */
import type { Locator, Page } from "@playwright/test";

import type { NoteState, NoteTempState, EntityListView, WebClientView, TestId, BookData } from "@librocco/shared";
import { SearchFieldInterface } from "./searchField";

/** A util type used to "pick" a subset of the given (union type) */
export type Subset<T, S extends T> = S;

export type WaitForOpts = Parameters<Locator["waitFor"]>[0];
export type GetByTextOpts = Parameters<Locator["getByText"]>[1];

export type InventoryRowField = keyof InventoryFieldLookup;
export type HistoryRowField = keyof HistoryFieldLookup;

export type DashboardNode<T = {}> = T &
	Locator & {
		dashboard: () => DashboardInterface;
	};

export interface IBookPrice {
	price: string;
	discount?: string;
	discountedPrice?: string;
}
/** @TODO Import this from shared (duplicate) */
export interface DisplayRow {
	isbn: string;
	title: string;
	quantity: number;
	warehouseId: number;
	price: number | string | IBookPrice;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;
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
	bookForm(): BookFormInterface;
	customItemForm(): CustomItemFormInterface;
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
	totalCoverPrice?: number;
	totalDiscountedPrice?: number;
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
	createNote(): Promise<void>;
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
	navigate(
		to:
			| Subset<EntityListView, "warehouse-list" | "inbound-list">
			| Subset<WebClientView, "history/date" | "history/isbn" | "history/notes" | "history/warehouse">
	): Promise<void>;
	scanField(): ScanFieldInterface;
	searchField(): SearchFieldInterface;
	table<V extends TableView>(view: V): V extends InventoryTableView ? InventoryTableInterface : HistoryTableInterface;
	calendar(id?: TestId): CalendarPicker;
	historyStats(): HistoryStatsInterface;
	stockReport(): StockReportInterface;
}>;

export type BreadcrumbsInterface = Asserter<string[]> & DashboardNode;

export type UpdatedAtInterface = Asserter<Date | string> &
	DashboardNode<{
		value(opts?: WaitForOpts): Promise<Date>;
	}>;

export type ContentHeaderInterface = DashboardNode<{
	title: () => Asserter<string>;
	breadcrumbs(): BreadcrumbsInterface;
	updatedAt(): UpdatedAtInterface;
	createNote(): Promise<void>;
	createWarehouse(): Promise<void>;
	commit(): Promise<void>;
}>;

export interface StatePickerInterface extends Locator {
	getState(opts?: WaitForOpts): Promise<NoteState | NoteTempState>;
	assertState(state: NoteState | NoteTempState, opts?: WaitForOpts): Promise<void>;
	select(state: NoteState): Promise<void>;
}

export type ScanFieldInterface = DashboardNode<{
	add(isbn: string): Promise<void>;
}>;

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
	category: string;
}

export type FormInterface<F extends keyof BookFormValues> = {
	field<N extends F>(name: N): BookFormFieldInterface<BookFormValues[N]>;
	fillData(entries: Partial<{ [K in F]: BookFormValues[K] }>): Promise<void>;
	submit(kind?: "keyboard" | "click"): Promise<void>;
	cancel(kind?: "keyboard" | "click"): Promise<void>;
};

export type BookFormInterface = FormInterface<keyof BookFormValues>;
export type CustomItemFormInterface = FormInterface<"title" | "price">;

export interface BookFormFieldInterface<T extends string | number | boolean> extends Locator {
	set: (value: T) => Promise<void>;
}
// #endregion book form

// #region inventory table
export type InventoryTableView = Subset<WebClientView, "inbound-note" | "outbound-note" | "warehouse" | "stock">;
export type HistoryTableView = Subset<WebClientView, "history/date" | "history/isbn" | "history/warehouse">;
export type TableView = InventoryTableView | HistoryTableView;

export interface AssertRowFieldsOpts {
	strict?: boolean;
	timeout?: number;
}

export type InventoryTableInterface = DashboardNode<{
	row(index: number): InventoryRowInterface;
	assertRows(rows: Partial<InventoryRowValues>[], opts?: AssertRowFieldsOpts): Promise<void>;
}>;
export type HistoryTableInterface = DashboardNode<{
	row(index: number): HistoryRowInterface;
	assertRows(rows: Partial<HistoryRowValues>[], opts?: AssertRowFieldsOpts): Promise<void>;
}>;

export type InventoryRowInterface = DashboardNode<{
	field<K extends InventoryRowField>(name: K): InventoryFieldLookup[K];
	assertFields(row: Partial<DisplayRow>, opts?: AssertRowFieldsOpts): Promise<void>;
	edit(): Promise<void>;
	delete(): Promise<void>;
}>;
export type HistoryRowInterface = DashboardNode<{
	field<K extends HistoryRowField>(name: K): HistoryFieldLookup[K];
	assertFields(row: Partial<DisplayRow>, opts?: AssertRowFieldsOpts): Promise<void>;
}>;

export interface InventoryWarehouseNameField extends AsserterSetter<string>, Locator {
	assertOptions(options: string[], opts?: WaitForOpts): Promise<void>;
}

export interface InventoryFieldLookup {
	isbn: Asserter<string>;
	title: Asserter<string>;
	authors: Asserter<string>;
	quantity: AsserterSetter<number>;
	year: Asserter<string>;
	publisher: Asserter<string>;
	price: Asserter<number | string | IBookPrice>;
	warehouseName: InventoryWarehouseNameField;
	editedBy: Asserter<string>;
	outOfPrint: Asserter<boolean>;
	category: Asserter<string>;
}
export interface HistoryFieldLookup {
	isbn: Asserter<string>;
	title: Asserter<string>;
	authors: Asserter<string>;
	quantity: AsserterSetter<number>;
	warehouseName: Asserter<string>;
	noteName: Locator & Asserter<string>;
	committedAt: Asserter<string | Date>;
}

export type InventoryRowValues = {
	[K in keyof InventoryFieldLookup]: InventoryFieldLookup[K] extends Asserter<infer T> ? T : never;
};
export type HistoryRowValues = {
	[K in keyof HistoryFieldLookup]: HistoryFieldLookup[K] extends Asserter<infer T> ? T : never;
};

export type GenericTransactionField = keyof Omit<InventoryFieldLookup, "quantity" | "warehouseName" | "price">;
// #endregion inventory table

// #region calendar picker
export interface CalendarPicker extends DashboardNode {
	open(): Promise<void>;
	close(): Promise<void>;
	select(date: string): Promise<void>;
}
// #endregion calendar picker

// #region history
export interface StatsField {
	assert(value: number): Promise<void>;
}

export interface HistoryStatsValues {
	inboundCount: number;
	inboundCoverPrice: number;
	inboundDiscountedPrice: number;
	outboundCount: number;
	outboundCoverPrice: number;
	outboundDiscountedPrice: number;
}

export interface HistoryStatsInterface extends DashboardNode {
	inboundCount(): StatsField;
	inboundCoverPrice(): StatsField;
	inboundDiscountedPrice(): StatsField;
	outboundCount(): StatsField;
	outboundCoverPrice(): StatsField;
	outboundDiscountedPrice(): StatsField;

	assert(values: HistoryStatsValues): Promise<void>;
}

export interface StockReportInterface extends DashboardNode {
	assert(values: [warehouseId: string, quantity: number][]): Promise<void>;
}
// #region history

// #region asserters
export interface Asserter<T> {
	assert(value: T, opts?: WaitForOpts): Promise<void>;
}

interface Setter<T> {
	set: (value: T) => Promise<void>;
}

type AsserterSetter<T> = Asserter<T> & Setter<T>;

export interface FieldConstructor<L extends Record<string, any>, K extends keyof L> {
	(parent: DashboardNode, view: TableView): L[K];
}
// #endregion asserters

// #region customerOrder
export type Customer = {
	id?: number;
	fullname?: string;
	email?: string;
	phone?: string;
	taxId?: string;
	displayId: string;
	deposit?: number;
	updatedAt?: Date;
};
// #endregion customerOrder

export type Supplier = {
	id?: number;
	name?: string;
	email?: string;
	address?: string;
};

export type SupplierOrder = {
	supplier_id: number;
	created: Date;
	lines: SupplierOrderLine[];
	id: number;
};
export type SupplierOrderLine = {
	supplier_id: number;
	supplier_name: string;
	isbn: string;
	title: string;
	authors: string;
	publisher: string;
	quantity: number;
	line_price: number;
};
export type PossibleSupplierOrderLine = {
	quantity: number;
	line_price: number;
} & SupplierJoinData &
	Pick<BookData, "isbn" | "title" | "authors">;

export type ReconciliationOrderLine = {
	reconciliation_order_id: number;
	isbn: string;
	created: number;
	quantity: number;
	authors: string;
	publisher: string;
	price: number;
	title: string;
};
export type ReconciliationOrder = {
	supplierOrderIds: number[];
	created: number;
	id?: number;
	finalized: boolean;
	updatedAt: Date;
};

export type SupplierJoinData = {
	supplier_id: number;
	supplier_name: string;
};
export type PlacedSupplierOrderLine = {
	supplier_order_id: number;
	created: number;
	total_book_number: number;
	total_book_price: number;
} & PossibleSupplierOrderLine;

export type PossibleSupplierOrder = {
	total_book_number: number;
	total_book_price: number;
} & SupplierJoinData;

/**
 * A placed supplier order: a batch of books ordered on a specific date
 * from the "possible" batch
 */
export type PlacedSupplierOrder = {
	id: number;
	created: number;
} & PossibleSupplierOrder;

type BookDataCols = Pick<BookData, "isbn" | "title" | "authors" | "price">;

export type DBCustomerOrderLine = {
	// A customer order line as it is stored in the database
	id: number;
	isbn: string;
	customer_id: number;
	created: number; // as milliseconds since epoch
	placed?: number; // as milliseconds since epoch
	received?: number; // as milliseconds since epoch
	collected?: number; // as milliseconds since epoch
};

export type CustomerOrderLine = {
	// A customer order line to be passed around in the application
	id: number;
	customer_id: number;
	created: Date; // Date when the book order was entered
	placed?: Date; // Last date when the book order was placed to the supplier
	received?: Date; // Date when the book order was received from the supplier
	collected?: Date; // Date when the book order was collected by the customer
} & BookDataCols;
