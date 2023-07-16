import type { Locator, Page } from "@playwright/test";

import type { BookFormValues, BookFormInterface, BookFormFieldInterface, DisplayRow } from "./types";

export function getBookForm(page: Page): BookFormInterface {
	const container = page.locator("#book-detail-form");

	const field = <N extends keyof BookFormValues>(name: N): BookFormFieldInterface<BookFormValues[N]> => {
		return bookFieldContstructors[name](container);
	};

	const submit = async () => {
		await container.press("Enter");
		await container.waitFor({ state: "detached" });
	};

	const fillBookData = async (entries: Partial<DisplayRow>) => {
		for (const [name, value] of Object.entries(entries)) {
			await field(name as keyof BookFormValues).set(value as BookFormValues[keyof BookFormValues]);
		}
	};

	const fillExistingData = async () => container.getByText("ISBN already exists, would you like to Edit it?").click();

	return Object.assign(container, { field, submit, fillBookData, fillExistingData });
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
	publisher: getPublisherField,
	editedBy: getStringField("editedBy"),
	outOfPrint: getOutOfPrintField
};

function getStringField(name: string) {
	return (form: Locator): BookFormFieldInterface<string> => {
		const container = form.getByRole("textbox", { name });
		const set = (value: string) => container.fill(value);
		return Object.assign(container, { set });
	};
}

function getPriceField(form: Locator): BookFormFieldInterface<number> {
	const container = form.getByRole("spinbutton", { name: "price" });
	const set = (value: number) => container.fill(value.toString());
	return Object.assign(container, { set });
}

function getOutOfPrintField(form: Locator): BookFormFieldInterface<boolean> {
	const container = form.getByLabel("Out of print");
	const set = (value: boolean) => (value ? container.check() : container.uncheck());
	return Object.assign(container, { set });
}

function getPublisherField(form: Locator): BookFormFieldInterface<string> {
	const container = form.locator("#publisher-field-container");

	const expandButton = (state?: "open" | "closed") => {
		switch (state) {
			case "open":
				return container.locator("button[aria-expanded=true]");
			case "closed":
				return container.locator("button[aria-expanded=false]");
			default:
				return container.locator("button");
		}
	};

	const open = async () => {
		try {
			// If the dropdown is closed, open it
			const button = expandButton("closed");
			await button.waitFor({ timeout: 100 });
			await button.click();
		} catch {
			// Already open (noop)
		} finally {
			// Ensure the dropdown is open
			await expandButton("open").waitFor();
		}
	};

	const close = async () => {
		try {
			// If the dropdown is open, close it
			const button = expandButton("open");
			await button.waitFor({ timeout: 100 });
			await button.click();
		} catch {
			// Already closed (noop)
		} finally {
			// Ensure the dropdown is closed
			await expandButton("closed").waitFor();
		}
	};

	const set = async (value: string) => {
		await open();
		// Find the desired option
		// TODO: We probably want to be able to add new publishers (this is a limited functionality for now)
		await container.getByRole("option", { name: value }).click();
		// Close the dropdown (if open)
		return close();
	};

	return Object.assign(container, { set });
}
