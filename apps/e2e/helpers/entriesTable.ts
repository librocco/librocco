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
	ViewName
} from "./types";

export function getEntriesTable(view: ViewName, content: Locator): EntriesTableInterface {
	const container = content.locator("#inventory-table");

	const row = (index: number) => getEntriesRow(view, container, index);

	const assertRows = async (rows: Partial<DisplayRow>[], opts: AssertRowFieldsOpts = { strict: false }) => {
		// Create an array of 10 nulls. This is our assertion template. We're filling the array with 'rows' passed as argument,
		// leaving us with an array of 10 rows, some of which are possibly nulls (in which case they shouldn't exist in the DOM)
		//
		// Note: 10 is the max number of rows displayed in the table for a single page.
		for (let index = 0; index < 10; index++) {
			const values = rows[index];

			// If no values are provided, we're expecting the row to not exist in the DOM (or we're waiting for it to be removed)
			// If using 'strict: false' we're expecting the row to exist in the DOM, but we don't care about the fields (e.g. {} for row values will suffice)
			if (!values) {
				await row(index).waitFor({ state: "detached" });
				continue;
			}

			// We're waiting for the row to be present before asserting the fields
			// this is for 'strict: false' case where we can pass an empty object and the assertion will pass without making any
			// DOM/locator queries (which is perfectly fine), but we want to make sure the row exists (even if we don't care about the fields)
			await row(index).waitFor();
			await row(index).assertFields(values, opts);
		}
	};

	const selectAll = () => container.locator("thead").locator("input[type='checkbox']").check();

	const unselectAll = () => container.locator("thead").locator("input[type='checkbox']").uncheck();

	const deleteSelected = async () => {
		await container.getByRole("button", { name: "Delete" }).click();
	};

	return Object.assign(container, { row, assertRows, deleteSelected, selectAll, unselectAll });
}

const defaultValues: TransactionRowValues = {
	isbn: "",
	price: 0,
	quantity: 1,
	title: "",
	year: "",
	authors: "",
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

	const field = <K extends TransactionRowField>(name: K) => fieldConstructorLookup[name](container);

	const assertFields = async (row: Partial<TransactionRowValues>, opts: AssertRowFieldsOpts = { strict: false }) => {
		// If strict we're asserting that the non-provided fields are the default values
		// whereas, for non-strict, we're asserting only for provided fields
		const compareObj = opts.strict ? { ...defaultValues, ...row } : row;

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
			await field<any>(name as keyof TransactionFieldInterfaceLookup).assert(value);
		}
	};

	return Object.assign(container, { field, assertFields, select, unselect });
}

interface FieldConstructor<K extends keyof TransactionFieldInterfaceLookup> {
	(row: Locator): TransactionFieldInterfaceLookup[K];
}

const stringFieldConstructor =
	<K extends GenericTransactionField>(name: K): FieldConstructor<K> =>
	(row) => ({
		assert: (want: string | number | boolean) => expect(row.locator(`[data-property="${name}"]`)).toHaveText(want.toString())
	});

const quantityFieldCostructor: FieldConstructor<"quantity"> = (row) => ({
	assert: (want) => expect(row.locator('[data-property="quantity"]').locator(`input`)).toHaveValue(want.toString()),
	set: async (value) => {
		const quantityInput = row.locator("[data-property='quantity']").locator("input");
		await quantityInput.fill(value.toString());
		await quantityInput.press("Enter");
	}
});

const outOfPrintFieldConstructor: FieldConstructor<"outOfPrint"> = (row) => ({
	assert: (want) => {
		const el = row.locator('[data-property="outOfPrint"]').locator(`input`);
		return want ? expect(el).toBeChecked() : expect(el).not.toBeChecked();
	}
});

const warehouseNameFieldConstructor: FieldConstructor<"warehouseName"> = (row) => ({
	assert: (want) => expect(row.locator('[data-property="warehouseName"]').locator("input")).toHaveValue(want)
});

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
