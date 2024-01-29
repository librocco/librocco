import { expect, type Locator } from "@playwright/test";

import {
	AssertRowFieldsOpts,
	DisplayRow,
	EntriesRowInterface,
	EntriesTableInterface,
	GenericTransactionField,
	TransactionFieldInterfaceLookup,
	TransactionRowField,
	TransactionRowValues,
	ViewName,
	WaitForOpts
} from "./types";

import { assertionTimeout } from "@/constants";

import { useExpandButton } from "./utils";

export function getEntriesTable(view: ViewName, content: Locator): EntriesTableInterface {
	const container = content.locator("#inventory-table");

	const row = (index: number) => getEntriesRow(view, container, index);

	const assertRows = async (rows: Partial<DisplayRow>[], opts: AssertRowFieldsOpts) => {
		// Create an array of 10 nulls. This is our assertion template. We're filling the array with 'rows' passed as argument,
		// leaving us with an array of 10 rows, some of which are possibly nulls (in which case they shouldn't exist in the DOM)
		//
		// Note: 10 is the max number of rows displayed in the table for a single page.
		for (let index = 0; index < 10; index++) {
			const values = rows[index];

			// If no values are provided, we're expecting the row to not exist in the DOM (or we're waiting for it to be removed)
			// If using 'strict: false' we're expecting the row to exist in the DOM, but we don't care about the fields (e.g. {} for row values will suffice)
			if (!values) {
				await row(index).waitFor({ state: "detached", timeout: assertionTimeout, ...opts });
				continue;
			}

			// We're waiting for the row to be present before asserting the fields
			// this is for 'strict: false' case where we can pass an empty object and the assertion will pass without making any
			// DOM/locator queries (which is perfectly fine), but we want to make sure the row exists (even if we don't care about the fields)
			await row(index).waitFor({ timeout: assertionTimeout, ...opts });
			await row(index).assertFields(values, opts);
		}
	};

	const selectAll = async () => {
		await container.locator("thead").locator("input[type='checkbox']").check();

		const selectCheckboxLocator = container.locator("tbody").locator("input[type='checkbox'][name*='Select']");

		// Count all the "Select (...)" row checkboxes and wait for them to be checked
		const count = await selectCheckboxLocator.count();
		for (let i = 0; i < count; i++) {
			await expect(selectCheckboxLocator.nth(i)).toBeChecked();
		}
	};

	const unselectAll = async () => {
		await container.locator("thead").locator("input[type='checkbox']").uncheck();

		const selectCheckboxLocator = container.locator("tbody").locator("input[type='checkbox'][name*='Select']");

		// Count all the "Select (...)" row checkboxes and wait for them to be unchecked
		const count = await selectCheckboxLocator.count();
		for (let i = 0; i < count; i++) {
			await expect(selectCheckboxLocator.nth(i)).toBeChecked();
		}
	};

	const deleteSelected = async () => {
		await container.getByRole("button", { name: "Delete" }).click();
	};

	return Object.assign(container, { row, assertRows, deleteSelected, selectAll, unselectAll });
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

function getEntriesRow(view: ViewName, table: Locator, index: number): EntriesRowInterface {
	const container = table.locator("tbody").getByRole("row").nth(index);

	const selectCheckbox = container.locator("input[name*='Select']");

	const select = () => selectCheckbox.check();

	const unselect = () => selectCheckbox.uncheck();

	const field = <K extends TransactionRowField>(name: K) => fieldConstructorLookup[name](container, view);

	const assertFields = async (row: Partial<TransactionRowValues>, opts: AssertRowFieldsOpts) => {
		// If strict we're asserting that the non-provided fields are the default values
		// whereas, for non-strict, we're asserting only for provided fields
		const compareObj = opts?.strict ? { ...defaultValues, ...row } : row;

		// We're using the following lookups to skip the fields, possibly provided in the `compareObj`, but not present in the view
		const rowFieldsLookup = {
			stock: ["isbn", "title", "authors", "quantity", "price", "year", "publisher", "editedBy", "outOfPrint"],
			inbound: ["isbn", "title", "authors", "quantity", "price", "year", "publisher", "editedBy", "outOfPrint"],
			outbound: ["isbn", "title", "authors", "quantity", "price", "year", "warehouseName"]
		};

		for (const entry of Object.entries(compareObj)) {
			const [name, value] = entry;
			// Skip fields not visible in the particular view
			if (!rowFieldsLookup[view].includes(name)) continue;
			await field<any>(name as keyof TransactionFieldInterfaceLookup).assert(value, opts);
		}
	};

	return Object.assign(container, { field, assertFields, select, unselect });
}

interface FieldConstructor<K extends keyof TransactionFieldInterfaceLookup> {
	(row: Locator, view: ViewName): TransactionFieldInterfaceLookup[K];
}

const stringFieldConstructor =
	<K extends GenericTransactionField>(name: K): FieldConstructor<K> =>
	(row) => ({
		assert: (want: string | number | boolean, opts?: WaitForOpts) =>
			expect(row.locator(`[data-property="${name}"]`)).toHaveText(want.toString(), { timeout: assertionTimeout, ...opts })
	});

const quantityFieldCostructor: FieldConstructor<"quantity"> = (row, view) => ({
	assert: (want, opts) =>
		view === "stock"
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

	const { open, close } = useExpandButton(container, { throttle: 500 });

	const set = async (value: string) => {
		await open();
		// Find the desired option
		await container.getByRole("option", { name: value }).click();
		// Close the dropdown (if open)
		await close();
	};

	const assert = (want: string, opts?: WaitForOpts) =>
		expect(row.locator('[data-property="warehouseName"]').locator("input")).toHaveValue(want, { timeout: assertionTimeout, ...opts });

	const assertOptions = async (options: string[], opts?: WaitForOpts) => {
		// Open the dropdown
		await open();
		// Assert the options appear in the same order
		await Promise.all(
			options.map((option, i) => expect(container.getByRole("option").nth(i)).toHaveText(option, { timeout: assertionTimeout, ...opts }))
		);
		// After the options are awaited (assertions have passed), check the length of the options (to make sure there are no extra options)
		await expect(container.getByRole("option")).toHaveCount(options.length, { timeout: assertionTimeout, ...opts });
		// Close the dropdown
		await close();
	};

	return Object.assign(container, { assert, set, assertOptions });
};

const fieldConstructorLookup: {
	[K in TransactionRowField]: FieldConstructor<K>;
} = {
	isbn: stringFieldConstructor("isbn"),
	title: stringFieldConstructor("title"),
	authors: stringFieldConstructor("authors"),
	price: stringFieldConstructor("price"),
	quantity: quantityFieldCostructor,
	publisher: stringFieldConstructor("publisher"),
	outOfPrint: outOfPrintFieldConstructor,
	warehouseName: warehouseNameFieldConstructor,
	editedBy: stringFieldConstructor("editedBy"),
	year: stringFieldConstructor("year")
};
