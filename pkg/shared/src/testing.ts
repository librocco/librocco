/** @TODO Set up exports so that we can use this as '@librocco/shared/testing' */

/** Union of names for all top-level views of the inventory app */
export type WebClientView =
	| "stock"
	| "inventory"
	| "outbound"
	| "settings"
	| "inbound-note"
	| "outbound-note"
	| "warehouse"
	| "settings"
	| "history/date"
	| "history/isbn"
	| "history/notes"
	| "history/warehouse"
	| "debug";
/** Union of names for all views containing entity lists (warehouses / notes) */
export type EntityListView = "warehouse-list" | "inbound-list" | "outbound-list";
/** Union of names for all views regarding history (summaries, past notes/transactions) */
export type HistoryView = "history/date" | "history/isbn" | "history/notes" | "history/warehouse";

/** A typesafe identity function (preventing typos) used to assign the value for the [data-view] property to the page container element */
export const view = (name: WebClientView) => name;
/** A typesafe identity function (preventing typos) used to assign the value for the [data-view] property to the entity list container element */
export const entityListView = (name: EntityListView) => name;
/** A typesafe identity function (preventing typos) used to assign the value for the [data-view] property to the history view container element */
export const historyView = (name: HistoryView) => name;

export type TestId =
	| "page-container"
	| "content-container"
	| "entity-list-container"
	| "dropdown-control"
	| "dropdown-menu"
	| "scan-input"
	| "search-input"
	| "popover-control"
	| "popover-container"
	| "edit-row"
	| "print-book-label"
	| "delete-row"
	| "book-form"
	| "custom-item-form";

/** A typesafe identity function (preventing typos) used to assign the value for the [data-testid] or plain HTML 'id' to the appropriate element */
export const testId = (name: TestId) => name;
