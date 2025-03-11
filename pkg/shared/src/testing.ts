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
	| "history"
	| "history/date"
	| "history/isbn"
	| "history/notes"
	| "history/warehouse"
	| "debug"
	| "error"
	| "c"
	| "s"
	| "orders/customers"
	| "orders/customers/id"
	| "orders/suppliers"
	| "orders/suppliers/orders"
	| "orders/suppliers/id"
	| "orders/suppliers/reconcile/id";

/** Union of names for all views containing entity lists (warehouses / notes) */
export type EntityListView = "warehouse-list" | "inbound-list" | "outbound-list" | "history/notes";
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
	| "search-completions-container"
	| "search-completion"
	| "popover-control"
	| "popover-container"
	| "edit-row"
	| "collect-row"
	| "delete-row"
	| "print-book-label"
	| "book-form"
	| "custom-item-form"
	| "calendar-picker-control"
	| "calendar-picker"
	| "calendar-picker-day-select"
	| "calendar-picker-month-select"
	| "calendar-from"
	| "calendar-to"
	| "history-date-stats"
	| "history-stock-report"
	| "history-stock-report-entry"
	| "database-management-container"
	| "database-management-list"
	| "db-action-export"
	| "db-action-delete";

/** A typesafe identity function (preventing typos) used to assign the value for the [data-testid] or plain HTML 'id' to the appropriate element */
export const testId = (name: TestId) => name;
