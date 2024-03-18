import { expect } from "@playwright/test";

import {
	AssertRowFieldsOpts,
	DashboardNode,
	DisplayRow,
	EntriesRowInterface,
	EntriesTableInterface,
	GenericTransactionField,
	TableView,
	TransactionFieldInterfaceLookup,
	TransactionRowField,
	TransactionRowValues,
	WaitForOpts
} from "./types";

import { assertionTimeout } from "@/constants";

import { getDropdown } from "./dropdown";

import { selector, testIdSelector } from "./utils";

export function getEntriesTable(parent: DashboardNode, view: TableView): EntriesTableInterface {
	const dashboard = parent.dashboard;
	const container = parent.locator("#inventory-table");

	const row = (index: number) => getEntriesRow(getEntriesTable(parent, view), view, index);

	const assertRows = async (rows: Partial<DisplayRow>[], opts: AssertRowFieldsOpts) => {
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

const defaultValues: Omit<TransactionRowValues, "price"> & { price: string | number } = {
	isbn: "",
	price: "N/A",
	quantity: 1,
	title: "N/A",
	year: "N/A",
	authors: "N/A",
	publisher: "",
	editedBy: "",
	warehouseName: "not-found",
	outOfPrint: false
};

function getEntriesRow(parent: DashboardNode, view: TableView, index: number): EntriesRowInterface {
	const dashboard = parent.dashboard;
	const container = parent.locator("tbody").getByRole("row").nth(index);

	const field = <K extends TransactionRowField>(name: K) => fieldConstructorLookup[name](getEntriesRow(parent, view, index), view);

	const actions = () => getRowActions(getEntriesRow(parent, view, index));

	const edit = () => {
		if (view === "warehouse") {
			return container.locator(testIdSelector("edit-row")).click();
		}
		return actions().edit();
	};
	const _delete = () => actions().delete();

	const assertFields = async (row: Partial<TransactionRowValues>, opts: AssertRowFieldsOpts) => {
		// If strict we're asserting that the non-provided fields are the default values
		// whereas, for non-strict, we're asserting only for provided fields
		const compareObj = opts?.strict ? { ...defaultValues, ...row } : row;

		// We're using the following lookups to skip the fields, possibly provided in the `compareObj`, but not present in the view
		const rowFieldsLookup = {
			warehouse: ["isbn", "title", "authors", "quantity", "price", "year", "publisher", "editedBy", "outOfPrint"],
			"inbound-note": ["isbn", "title", "authors", "quantity", "price", "year", "publisher", "editedBy", "outOfPrint"],
			"outbound-note": ["isbn", "title", "authors", "quantity", "price", "year", "warehouseName"]
		};

		await Promise.all(
			Object.entries(compareObj).map(async ([name, value]) => {
				// Skip fields not visible in the particular view
				if (!rowFieldsLookup[view].includes(name)) return;
				return field<any>(name as keyof TransactionFieldInterfaceLookup).assert(value, opts);
			})
		);
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

// #region row_fields
interface FieldConstructor<K extends keyof TransactionFieldInterfaceLookup> {
	(parent: DashboardNode, view: TableView): TransactionFieldInterfaceLookup[K];
}

const stringFieldConstructor =
	<K extends GenericTransactionField>(name: K, transformDisplay = (x: string) => x): FieldConstructor<K> =>
	(row) => ({
		assert: (want: string | number | boolean, opts?: WaitForOpts) =>
			expect(row.locator(`[data-property="${name}"]`)).toHaveText(transformDisplay(want.toString()), { timeout: assertionTimeout, ...opts })
	});

const quantityFieldCostructor: FieldConstructor<"quantity"> = (row, view) => ({
	assert: (want, opts) =>
		view === "warehouse"
			? expect(row.locator('[data-property="quantity"]')).toHaveText(want.toString(), { timeout: assertionTimeout, ...opts })
			: expect(row.locator('[data-property="quantity"]').locator(`input`)).toHaveValue(want.toString(), {
					timeout: assertionTimeout,
					...opts
			  }),
	set: async (value) => {
		const quantityInput = row.locator("[data-property='quantity']").locator("input");
		await quantityInput.fill(value.toString());
		await quantityInput.press("Enter");
	}
});

const outOfPrintFieldConstructor: FieldConstructor<"outOfPrint"> = (row) => ({
	assert: (want, opts) => {
		const el = row.locator('[data-property="outOfPrint"]').locator(`input`);
		return want
			? expect(el).toBeChecked({ timeout: assertionTimeout, ...opts })
			: expect(el).not.toBeChecked({ timeout: assertionTimeout, ...opts });
	}
});

const warehouseNameFieldConstructor: FieldConstructor<"warehouseName"> = (row) => {
	const container = row.locator('[data-property="warehouseName"]');

	const dropdown = getDropdown(row);
	const opened = dropdown.opened;

	const set = async (value: string) => {
		await opened(() => dropdown.getByText(value).click())();
		return dropdown.close();
	};

	const assert = (want: string, opts?: WaitForOpts) => expect(container).toContainText(want, { timeout: assertionTimeout, ...opts });

	const assertOptions = async (options: string[], opts?: WaitForOpts) => {
		// This implementation is rather dirty:
		// - the order of the options is not accounted for
		// - the number of options is not restricted (there could be any number of options, as long as the wanted ones are present and the test will pass - not really desired)
		//
		// TODO: Update this with combobox fixes / updates
		await opened(() => Promise.all(options.map((opt) => dropdown.getByText(opt).waitFor({ timeout: assertionTimeout, ...opts }))))();
		return dropdown.close();
	};

	return Object.assign(container, { assert, set, assertOptions });
};

const fieldConstructorLookup: {
	[K in TransactionRowField]: FieldConstructor<K>;
} = {
	isbn: stringFieldConstructor("isbn"),
	title: stringFieldConstructor("title"),
	authors: stringFieldConstructor("authors"),
	price: stringFieldConstructor("price", (x) => (x === "N/A" ? x : `€${Number.parseFloat(x).toFixed(2)}`)),
	quantity: quantityFieldCostructor,
	publisher: stringFieldConstructor("publisher"),
	outOfPrint: outOfPrintFieldConstructor,
	warehouseName: warehouseNameFieldConstructor,
	editedBy: stringFieldConstructor("editedBy"),
	year: stringFieldConstructor("year")
};
// #endregion row_fields
