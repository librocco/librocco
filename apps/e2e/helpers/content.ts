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

import { getDashboard } from "./dashboard";
import { getEntriesTable } from "./entriesTable";

export function getContent(page: Page): ContentInterface {
	const container = page.locator("#table-section");

	const heading = (title?: string, opts?: GetByTextOpts): ContentHeadingInterface => getHeading(container, title, opts);

	const updatedAt = async (): Promise<Date> => {
		const updatedAtElement = container.getByText("Last updated:");
		await updatedAtElement.waitFor();

		const updatedAtString = await updatedAtElement.evaluate((element) => element.textContent);

		return new Date(
			updatedAtString
				// Replace the " at " separator (webkit formatted date) to a regular date string
				.replace(" at ", ", ")
				.replace("Last updated: ", "")
		);
	};

	const assertUpdatedAt = async (date: Date): Promise<void> => {
		const updatedAtDate = await updatedAt();
		const updatedAtMillis = updatedAtDate.getTime();

		// Without mocking the date, we can't assert the exact date, but we can expect the updated at to be under a minute from now
		const dateMillis = date.getTime() - 60 * 1000;

		expect(dateMillis).toBeLessThan(updatedAtMillis);
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
			const textContent = await element.textContent(opts);
			return textContent.trim();
		} catch {
			return "";
		}
	};

	const rename = async (newName: string) => {
		await element.click();

		const input = container.getByRole("textbox");

		await input.fill(newName);
		await input.press("Enter");

		await getDashboard(container.page()).sidebar().link(newName).waitFor();
	};

	return Object.assign(element, { getTitle, rename });
}

function getStatePicker(content: Locator): StatePickerInterface {
	const container = content.locator("#note-state-picker");

	const getState = () => container.locator("#current-value").getAttribute("data-value") as Promise<NoteState | NoteTempState>;

	const assertState = (state: NoteState | NoteTempState) => container.locator(`#current-value[data-value="${state}"]`).waitFor();

	const expandButton = container.locator("button[aria-haspopup='true']");

	const isExpanded = async () => {
		const expanded = await expandButton.getAttribute("aria-expanded");
		return expanded === "true";
	};

	const open = async () => {
		const expanded = await isExpanded();
		if (expanded) {
			return;
		}
		await expandButton.click();
	};

	const select = async (newState: NoteState) => {
		const currentState = await getState();

		console.log("Current state:", currentState);
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
