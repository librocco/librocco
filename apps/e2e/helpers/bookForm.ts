import type { Locator, Page } from "@playwright/test";

import type { BookFormValues, BookFormInterface, BookFormFieldInterface, DisplayRow } from "./types";

import { useExpandButton } from "./utils";

export function getBookForm(page: Page): BookFormInterface {
	const container = page.locator("#book-detail-form");

	const field = <N extends keyof BookFormValues>(name: N): BookFormFieldInterface<BookFormValues[N]> => {
		return bookFieldContstructors[name](container);
	};

	const submit = async (kind: "click" | "keyboard" = "keyboard") => {
		if (kind === "keyboard") {
			await container.press("Enter");
		} else {
			await container.getByRole("button", { name: "Save" }).click();
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

	const { open, close } = useExpandButton(container, { throttle: 200 });

	const select = async (value: string) => {
		await open();
		// Find the desired option
		// TODO: We probably want to be able to add new publishers (this is a limited functionality for now)
		await container.getByRole("option", { name: value }).click();
		// Close the dropdown (if open)
		return close();
	};

	const set = async (value: string) => {
		await container.getByRole("combobox", { name: "publisher" }).fill(value);
		// TODO: This shouldn't be necessary, but there's a bug we couldn't shake for the time being and that is
		// the fact that the dropdown closes on click outside, blocking the click event further and this way we're
		// ensuring that the dropdown is closed before we continue with interactions
		await close();
	};

	return Object.assign(container, { set, select });
}
