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
	| "history"
	| "debug";
/** Union of names for all views containing entity lists (warehouses / notes) */
export type EntityListView = "warehouse-list" | "inbound-list" | "outbound-list";

/** A typesafe identity function (preventing typos) used to assign the value for the [data-view] property to the page container element */
export const view = (name: WebClientView) => name;
/** A typesafe identity function (preventing typos) used to assign the value for the [data-view] property to the entity list container element */
export const entityListView = (name: EntityListView) => name;

export type TestId =
	| "page-container"
	| "content-container"
	| "entity-list-container"
	| "dropdown-control"
	| "dropdown-menu"
	| "scan-input"
	| "popover-control"
	| "popover-container"
	| "edit-row"
	| "print-book-label"
	| "delete-row"
	| "book-form"
	| "scan-autofocus-toggle";

/** A typesafe identity function (preventing typos) used to assign the value for the [data-testid] or plain HTML 'id' to the appropriate element */
export const testId = (name: TestId) => name;
