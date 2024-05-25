import type { Locator } from "@playwright/test";

import type { BookFormValues, BookFormInterface, BookFormFieldInterface, DisplayRow, DashboardNode } from "./types";

import { idSelector, selector } from "./utils";

export function getBookForm(parent: DashboardNode): BookFormInterface {
	const dashboard = parent.dashboard;
	const page = parent.page();
	const container = page.locator(selector(idSelector("book-form")));

	const field = <N extends keyof BookFormValues>(name: N): BookFormFieldInterface<BookFormValues[N]> => {
		return bookFieldContstructors[name](container);
	};

	const submit = async (kind: "click" | "keyboard" = "keyboard") => {
		if (kind === "keyboard") {
			await container.press("Enter");
		} else {
			// Note: This might cause conflicts if there ever are multiple instances of "Save" text within the form.
			// That's unlikely to be the case and it will be caught by tests (immediately), but for now it's the only convenient
			// way to handle this as selector 'button[name="Save"]' doesn't yield the element.
			await container.getByText("Save").click();
		}
		await container.waitFor({ state: "detached" });
	};

	const fillBookData = async (entries: Partial<DisplayRow>) => {
		for (const [name, value] of Object.entries(entries)) {
			// Skip isbn field as it's not editable
			if (name === "isbn") continue;
			await field(name as keyof BookFormValues).set(value as BookFormValues[keyof BookFormValues]);
		}
	};

	const fillExistingData = async () => container.getByText("ISBN already exists, would you like to Edit it?").click();

	return Object.assign(container, { dashboard, field, submit, fillBookData, fillExistingData });
}

type BookFieldContstructors = {
	[N in keyof BookFormValues]: (form: Locator) => BookFormFieldInterface<BookFormValues[N]>;
};
const bookFieldContstructors: BookFieldContstructors = {
	isbn: getStringField("isbn"),
	title: getStringField("title"),
	price: getPriceField,
	year: getStringField("year"),
	authors: getStringField("authors"),
	// We're treating the publisher field as a bare input, not a combobox.
	// We might want to expand on this in the future.
	publisher: getStringField("publisher"),
	editedBy: getStringField("editedBy"),
	category: getStringField("category"),
	outOfPrint: getOutOfPrintField
};

function getStringField(name: string) {
	return (form: Locator): BookFormFieldInterface<string> => {
		const container = form.locator(`input[name="${name}"]`);
		const set = (value: string) => container.fill(value);
		return Object.assign(container, { set });
	};
}

function getPriceField(form: Locator): BookFormFieldInterface<number> {
	const container = form.locator('input[name="price"]');
	const set = (value: number) => container.fill(value.toString());
	return Object.assign(container, { set });
}

function getOutOfPrintField(form: Locator): BookFormFieldInterface<boolean> {
	const container = form.getByLabel("Out of print");
	const set = (value: boolean) => (value ? container.check() : container.uncheck());
	return Object.assign(container, { set });
}
