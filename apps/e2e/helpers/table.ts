import { Locator, Page, expect } from "@playwright/test";

import { enumerate } from "@librocco/shared";

import {
	AssertRowFieldsOpts,
	DashboardNode,
	IBookPrice,
	InventoryFieldLookup,
	InventoryRowField,
	InventoryRowValues,
	HistoryRowField,
	InventoryTableView,
	WaitForOpts,
	HistoryFieldLookup,
	InventoryRowInterface,
	InventoryTableInterface,
	HistoryRowValues,
	HistoryRowInterface,
	HistoryTableInterface,
	HistoryTableView,
	Asserter,
	FieldConstructor,
	TableView,
	IWarehouseName
} from "./types";

import { assertionTimeout } from "@/constants";

import { getDropdown } from "./dropdown";

import { selector, stringFieldConstructor, testIdSelector } from "./utils";
import { getDateString } from "./dateString";

// #region inventory table
export function getInventoryTable(parent: DashboardNode, view: InventoryTableView): InventoryTableInterface {
	const dashboard = parent.dashboard;

	const container = parent.locator("#inventory-table");

	const row = (index: number) => getInventoryRow(getInventoryTable(parent, view), view, index);

	const assertRows = async (rows: Partial<InventoryRowValues>[], opts: AssertRowFieldsOpts) => {
		// Check for empty state
		if (rows.length === 0) {
			await row(0).waitFor({ state: "detached", timeout: assertionTimeout, ...opts });
			return;
		}

		// Check that there are enough rows to match the required number
		await row(rows.length - 1).waitFor();

		// NOTE: matching row by row in synchronous manner to prevent flakiness due to rows jumping up and down
		for (const [ix, values] of enumerate(rows)) {
			await row(ix).assertFields(values, opts);
		}

		// Check that there are no more rows than specified
		await row(rows.length).waitFor({ state: "detached", timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { dashboard, row, assertRows });
}

const defaultInventoryRowValues: InventoryRowValues = {
	isbn: "",
	price: "€0.00",
	quantity: 1,
	title: "N/A",
	year: "N/A",
	authors: "N/A",
	publisher: "",
	editedBy: "",
	warehouseName: "Select a warehouse",
	outOfPrint: false,
	category: "",
	type: ""
};

function getInventoryRow(parent: DashboardNode, view: InventoryTableView, index: number): InventoryRowInterface {
	const dashboard = parent.dashboard;
	const container = parent.locator("tbody").getByRole("row").nth(index);

	const field = <K extends InventoryRowField>(name: K) => inventoryFieldConstructorLookup[name](getInventoryRow(parent, view, index), view);

	const actions = () => getRowActions(getInventoryRow(parent, view, index));

	const edit = () => actions().edit();
	const _delete = () => actions().delete();

	const assertFields = async (row: Partial<InventoryRowValues>, opts: AssertRowFieldsOpts) => {
		// If strict we're asserting that the non-provided fields are the default values
		// whereas, for non-strict, we're asserting only for provided fields
		const compareObj = opts?.strict ? { ...defaultInventoryRowValues, ...row } : row;

		// We're using the following lookups to skip the fields, possibly provided in the `compareObj`, but not present in the view
		const rowFieldsLookup = {
			stock: ["isbn", "title", "authors", "quantity", "price", "year", "publisher", "editedBy", "outOfPrint", "category"],
			warehouse: ["isbn", "title", "authors", "quantity", "price", "year", "publisher", "editedBy", "outOfPrint", "category"],
			"inbound-note": ["isbn", "title", "authors", "quantity", "price", "year", "publisher", "editedBy", "outOfPrint", "category"],
			"outbound-note": ["isbn", "title", "authors", "quantity", "price", "year", "warehouseName", "category", "type"]
		};

		const rowMatcher = Object.entries(compareObj)
			// Skip fields not visible in the particular view
			.filter(([name]) => rowFieldsLookup[view].includes(name))
			.map(([name, value]) => field<any>(name).assertedLocator(dashboard().page(), value))
			.reduce((acc, curr) => acc.filter({ has: curr }), container);

		return rowMatcher.waitFor({ timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { dashboard, field, assertFields, edit, delete: _delete });
}

type RowActions = DashboardNode<{
	edit(): Promise<void>;
	delete(): Promise<void>;
}>;

function getRowActions(parent: DashboardNode): RowActions {
	const dashboard = parent.dashboard;
	const page = dashboard().page();

	// Popover control button
	const control = parent.locator(selector(testIdSelector("popover-control")));

	// Note: container will be present only if the popover is open
	//
	// We're matching the popover menu from the root node (page) as it'a portalled to the end of the HTML
	const container = page.locator(selector(testIdSelector("popover-container")));

	// We could, in theory, use the 'waitFor' (and 'waitFor({ state: "detached" })') for the checks,
	// but that would be an assertion and can't be used (error-safe) for mere (soft) checks
	const isOpen = () => control.getAttribute("aria-expanded").then((e) => e === "true");

	const open = async () => {
		// Noop if the dropdown is already open
		if (await isOpen()) return;
		await control.click();
		return container.waitFor();
	};

	const opened = (fn: () => Promise<any>) => async () => {
		await open();
		return fn();
	};

	const edit = opened(() => container.locator(selector(testIdSelector("edit-row"))).click());
	const _delete = opened(() => container.locator(selector(testIdSelector("delete-row"))).click());

	return Object.assign(container, { dashboard, edit, delete: _delete });
}
// #region inventory table

// #region history table
export function getHistoryTable(parent: DashboardNode, view: HistoryTableView): HistoryTableInterface {
	const dashboard = parent.dashboard;

	const container = parent.locator("#history-table");

	const row = (index: number) => getHistoryRow(getHistoryTable(parent, view), view, index);

	const assertRows = async (rows: Partial<HistoryRowValues>[], opts: Pick<AssertRowFieldsOpts, "timeout">) => {
		await Promise.all(
			rows.map(async (values, index) => {
				// We're waiting for the row to be present before asserting the fields
				// this is for 'strict: false' case where we can pass an empty object and the assertion will pass without making any
				// DOM/locator queries (which is perfectly fine), but we want to make sure the row exists (even if we don't care about the fields)
				await row(index).waitFor({ timeout: assertionTimeout, ...opts });
				return row(index).assertFields(values, opts);
			})
		);

		// Check that there are no more rows than specified in the want 'rows' array
		await row(rows.length).waitFor({ state: "detached", timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { dashboard, row, assertRows });
}

function getHistoryRow(parent: DashboardNode, view: HistoryTableView, index: number): HistoryRowInterface {
	const dashboard = parent.dashboard;
	const container = parent.locator("li").nth(index);

	// We're using the following lookups to skip the fields, possibly provided in the `compareObj`, but not present in the view
	const field = <K extends HistoryRowField>(name: K) => historyFieldConstructorLookup[name](getHistoryRow(parent, view, index), view);

	const assertFields = async (row: Partial<HistoryRowValues>, opts: Pick<AssertRowFieldsOpts, "timeout">) => {
		await Promise.all(
			Object.entries(row).map(async ([name, value]) => {
				return field<any>(name).assert(value, opts);
			})
		);
	};

	return Object.assign(container, { dashboard, field, assertFields });
}
// #region history table

// #region row_fields
const priceFieldConstructor: FieldConstructor<InventoryFieldLookup, "price"> = (row) => {
	type T = IBookPrice | string | number;
	const _assertedLocator = (page: Page, container: Page | Locator, want: T): Locator => {
		const el = container.locator('[data-property="price"]');

		switch (typeof want) {
			case "number": {
				return el.locator(`[data-property="full-price"]`, { hasText: `€${want.toFixed(2)}` });
			}
			case "string": {
				return el.locator(`[data-property="full-price"]`, { hasText: want });
			}
			case "object": {
				return el
					.filter({ has: page.locator(`[data-property="full-price"]`, { hasText: want.price }) })
					.filter({ has: page.locator(`[data-property="discounted-price"]`, { hasText: want.discountedPrice }) })
					.filter({ has: page.locator(`[data-property="applied-discount"]`, { hasText: want.discount.toString() }) });
			}
		}
	};

	const assertedLocator = (page: Page, want: T) => _assertedLocator(page, page, want);
	const assert = (want: T, opts?: WaitForOpts) => _assertedLocator(row.page(), row, want).waitFor({ timeout: assertionTimeout, ...opts });

	return { assertedLocator, assert };
};

const quantityFieldCostructor: FieldConstructor<InventoryFieldLookup & HistoryFieldLookup, "quantity"> = (row, view) => {
	const _assertedLocator = (container: Page | Locator, want: number): Locator =>
		view === "warehouse"
			? container.locator('[data-property="quantity"]', { hasText: want.toString() })
			: // NOTE: matching by data-value is a horrible hack, but we can't set up a locator in such a way as to match the input value
				// (and we need a locator, not an assertion as we're using these to build out a single matcher for the full row)
				container.locator('[data-property="quantity"]').locator(`input[data-value="${want}"]`);

	const assertedLocator = (page: Page, want: number) => _assertedLocator(page, want);
	const assert = (want: number, opts?: WaitForOpts) => _assertedLocator(row, want).waitFor({ timeout: assertionTimeout, ...opts });
	const set = async (value: number) => {
		const input = row.locator('[data-property="quantity"]').locator("input");
		await input.fill(value.toString());
		await input.press("Enter");
	};

	return { assertedLocator, assert, set };
};

const outOfPrintFieldConstructor: FieldConstructor<InventoryFieldLookup, "outOfPrint"> = (row) => {
	const _assertedLocator = (container: Page | Locator, want: boolean): Locator =>
		want
			? container.locator('[data-property="outOfPrint"]').locator(`input:checked`)
			: container.locator('[data-property="outOfPrint"]').locator(`input:not(checked)`);

	const assertedLocator = (page: Page, want: boolean) => _assertedLocator(page, want);
	const assert = (want: boolean, opts?: WaitForOpts) => _assertedLocator(row, want).waitFor({ timeout: assertionTimeout, ...opts });

	return { assertedLocator, assert };
};

const warehouseNameFieldConstructor: FieldConstructor<InventoryFieldLookup, "warehouseName"> = (row) => {
	type T = string | IWarehouseName;

	const container = row.locator('[data-property="warehouseName"]');

	const DEFAULT_LABEL = "Select a warehouse";

	const dropdown = getDropdown(row);
	const opened = dropdown.opened;

	const set = async (value: string) => {
		await opened(() => dropdown.getByText(value).click())();
		// Close the dropdown if open (we're not doing this over the dropdown interface as the disappearing dropdown might cause flaky tests)
		return container.page().keyboard.press("Escape");
	};

	const _assertedLocator = (container: Page | Locator, want: T): Locator => {
		const isObjectMatcher = typeof want === "object";

		const name = isObjectMatcher ? want.name : want;
		const wantText = name === "" ? DEFAULT_LABEL : name;

		const baseMatcher = container.locator('[data-property="warehouseName"]').locator("button").filter({ hasText: wantText });

		// Matching by name only
		if (!isObjectMatcher) {
			return baseMatcher;
		}

		// Matching by { name, forced } object
		const { forced } = want as IWarehouseName;

		if (forced) {
			return baseMatcher.filter({ hasText: "Forced" });
		}

		return baseMatcher.filter({ hasNotText: "Forced" });
	};

	const assertedLocator = (page: Page, want: string) => _assertedLocator(page, want);
	const assert = (want: string, opts?: WaitForOpts) => _assertedLocator(row, want).waitFor({ timeout: assertionTimeout, ...opts });

	const assertOptions = async (options: string[], opts?: WaitForOpts) => {
		// This implementation is rather dirty:
		// - the order of the options is not accounted for
		// - the number of options is not restricted (there could be any number of options, as long as the wanted ones are present and the test will pass - not really desired)
		//
		// TODO: Update this with combobox fixes / updates
		await opened(() => Promise.all(options.map((opt) => dropdown.getByText(opt).waitFor({ timeout: assertionTimeout, ...opts }))))();
		return dropdown.close();
	};

	return Object.assign(container, { assertedLocator, assert, set, assertOptions });
};

const noteNameFieldConstructor = (row: DashboardNode): Locator & Asserter<string> => {
	const container = row.locator('[data-property="noteName"]');
	return Object.assign(container, {
		assert: (want: string, opts?: WaitForOpts) => expect(container).toHaveText(want, { timeout: assertionTimeout, ...opts })
	});
};

const committedAtConstructor = (row: DashboardNode, view: TableView): Asserter<string | Date> => {
	const container = Object.assign(row.locator('[data-property="committedAt"]'), { dashboard: row.dashboard });

	const extractDate = (str: string) => (view === "history/isbn" ? new Date(str) : new Date(str));
	const dateElement = getDateString(container, "", extractDate);

	return { assert: (want: string, opts?: WaitForOpts) => dateElement.assert(want, opts) };
};

const inventoryFieldConstructorLookup: {
	[K in InventoryRowField]: FieldConstructor<InventoryFieldLookup, K>;
} = {
	isbn: stringFieldConstructor("isbn"),
	title: stringFieldConstructor("title"),
	authors: stringFieldConstructor("authors"),
	price: priceFieldConstructor,
	quantity: quantityFieldCostructor,
	publisher: stringFieldConstructor("publisher"),
	outOfPrint: outOfPrintFieldConstructor,
	warehouseName: warehouseNameFieldConstructor,
	editedBy: stringFieldConstructor("editedBy"),
	category: stringFieldConstructor("category"),
	year: stringFieldConstructor("year"),
	type: stringFieldConstructor("type")
};

const historyFieldConstructorLookup: {
	[K in HistoryRowField]: FieldConstructor<HistoryFieldLookup, K>;
} = {
	isbn: stringFieldConstructor("isbn"),
	title: stringFieldConstructor("title"),
	authors: stringFieldConstructor("authors"),
	quantity: stringFieldConstructor("quantity"),
	warehouseName: stringFieldConstructor("warehouseName"),
	noteName: noteNameFieldConstructor,
	committedAt: committedAtConstructor
};
// #endregion row_fields
