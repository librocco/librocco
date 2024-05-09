import type { Locator } from "@playwright/test";

import { TestId } from "@librocco/shared";

import type { BookFormValues, FormInterface, BookFormFieldInterface, DashboardNode } from "./types";

import { idSelector, selector } from "./utils";

function constructForm<F extends keyof BookFormValues>(
	id: TestId,
	fetchData: (container: Locator) => Promise<any>
): (parent: DashboardNode) => FormInterface<F> {
	return (parent: DashboardNode) => {
		const dashboard = parent.dashboard;
		const page = parent.page();
		const container = page.locator(selector(idSelector(id)));

		const field = <N extends F>(name: N): BookFormFieldInterface<BookFormValues[N]> => {
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

		const fillData = async (entries: Partial<{ [K in F]: BookFormValues[K] }>) => {
			for (const [name, value] of Object.entries(entries)) {
				// Skip isbn field as it's not editable
				if (name === "isbn") continue;
				await field(name as F).set(value as BookFormValues[F]);
			}
		};

		return Object.assign(container, { dashboard, field, submit, fillData, fetchData: () => fetchData(container) });
	};
}

// TODO: add functionality for book data fetching
export const getBookForm = constructForm<keyof BookFormValues>("book-form", Promise.resolve);

export const getCustomItemForm = constructForm<"title" | "price">("custom-item-form", Promise.resolve);

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
