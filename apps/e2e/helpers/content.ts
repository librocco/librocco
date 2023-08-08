import { type Locator, type Page, expect } from "@playwright/test";

import { NoteTempState, type NoteState } from "@librocco/shared";

import type {
	WaitForOpts,
	ContentInterface,
	ContentHeadingInterface,
	StatePickerInterface,
	GetByTextOpts,
	ScanFieldInterface,
	ViewName
} from "./types";

import { assertionTimeout } from "../constants";

import { getDashboard } from "./dashboard";
import { getEntriesTable } from "./entriesTable";

import { useExpandButton } from "./utils";

export function getContent(page: Page): ContentInterface {
	const container = page.locator("#table-section");

	const heading = (title?: string, opts?: GetByTextOpts & WaitForOpts): ContentHeadingInterface => getHeading(container, title, opts);

	const updatedAt = async (opts?: WaitForOpts): Promise<Date> => {
		const updatedAtElement = container.getByText("Last updated:");
		await updatedAtElement.waitFor({ timeout: assertionTimeout, ...opts });

		const updatedAtString = await updatedAtElement.evaluate((element) => element.textContent, null, {
			timeout: assertionTimeout,
			...opts
		});

		return new Date(
			updatedAtString
				// Replace the " at " separator (webkit formatted date) to a regular date string
				.replace(" at ", ", ")
				.replace("Last updated: ", "")
		);
	};

	const assertUpdatedAt = async (date: Date, opts?: WaitForOpts & { precision?: number }): Promise<void> => {
		const updatedAtDate = await updatedAt(opts);
		const updatedAtMillis = updatedAtDate.getTime();

		// Without mocking the date, we can't assert the exact date, but we can expect the 'updatedAt' to be close to the want date
		const { precision = 60 * 1000 } = opts || {};
		const dateCheckMillis = date.getTime() - precision;

		expect(updatedAtMillis).toBeGreaterThan(dateCheckMillis);
	};

	const statePicker = (): StatePickerInterface => {
		return getStatePicker(container);
	};

	const scanField = (): ScanFieldInterface => getScanField(container);

	const entries = (view: ViewName) => getEntriesTable(view, container);

	return Object.assign(container, { heading, updatedAt, assertUpdatedAt, statePicker, scanField, entries });
}

function getHeading(content: Locator, title?: string, opts?: GetByTextOpts): ContentHeadingInterface {
	const container = content.getByRole("heading");

	const element = title ? container.getByText(title, opts) : container.locator("p");

	const getTitle = async (opts?: WaitForOpts) => {
		try {
			const textContent = await element.textContent({ timeout: assertionTimeout, ...opts });
			return textContent.trim();
		} catch {
			return "";
		}
	};

	const rename = async (newName: string, opts?: WaitForOpts) => {
		await element.click();

		const input = container.getByRole("textbox");

		await input.fill(newName);
		await input.press("Enter");

		await getDashboard(container.page())
			.sidebar()
			.link(newName)
			.waitFor({ timeout: assertionTimeout, ...opts });
	};

	return Object.assign(element, { getTitle, rename });
}

function getStatePicker(content: Locator): StatePickerInterface {
	const container = content.locator("#note-state-picker");

	const getState = (opts?: WaitForOpts) =>
		container.locator("#current-value").getAttribute("data-value", { timeout: assertionTimeout, ...opts }) as Promise<
			NoteState | NoteTempState
		>;

	const assertState = (state: NoteState | NoteTempState, opts?: WaitForOpts) =>
		container.locator(`#current-value[data-value="${state}"]`).waitFor({ timeout: assertionTimeout, ...opts });

	const { open } = useExpandButton(container);

	const select = async (newState: NoteState) => {
		const currentState = await getState();

		if (currentState === newState) {
			return;
		}

		await open();

		await container.locator(`[data-option="${newState}"]`).click();
	};

	return Object.assign(container, { getState, assertState, select });
}

function getScanField(content: Locator): ScanFieldInterface {
	const container = content.locator("#scan-input-container");
	const input = container.locator("input");

	const add = async (isbn: string) => {
		await input.fill(isbn);
		await input.press("Enter");
	};

	const create = () => container.getByRole("button", { name: "Create" }).click();

	return Object.assign(input, { add, create });
}
