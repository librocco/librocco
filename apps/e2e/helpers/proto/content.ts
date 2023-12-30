import { type Locator, type Page } from "@playwright/test";

// import { NoteTempState, type NoteState } from "@librocco/shared";

import type {
	WaitForOpts,
	ContentInterface,
	// ContentHeadingInterface,
	// StatePickerInterface,
	// GetByTextOpts,
	ContentHeaderInterface
	// ScanFieldInterface
	// ViewName
} from "./types";

import { assertionTimeout } from "@/constants";

// import { assertionTimeout } from "@/constants";

// import { getDashboard } from "./dashboard";
// import { getEntriesTable } from "./entriesTable";

// import { useExpandButton } from "./utils";

export function getContent(page: Page): ContentInterface {
	const container = page.locator("#content");

	const header = () => getHeader(container);

	// 	const updatedAt = async (opts?: WaitForOpts): Promise<Date> => {
	// 		const updatedAtElement = container.getByText("Last updated:");
	// 		await updatedAtElement.waitFor({ timeout: assertionTimeout, ...opts });
	//
	// 		const updatedAtString = await updatedAtElement.evaluate((element) => element.textContent, null, {
	// 			timeout: assertionTimeout,
	// 			...opts
	// 		});
	//
	// 		return new Date(
	// 			updatedAtString
	// 				// Replace the " at " separator (webkit formatted date) to a regular date string
	// 				.replace(" at ", ", ")
	// 				.replace("Last updated: ", "")
	// 		);
	// 	};

	// 	const assertUpdatedAt = async (date: Date, opts?: WaitForOpts & { precision?: number }): Promise<void> => {
	// 		const updatedAtDate = await updatedAt(opts);
	// 		const updatedAtMillis = updatedAtDate.getTime();
	//
	// 		// Without mocking the date, we can't assert the exact date, but we can expect the 'updatedAt' to be close to the want date
	// 		const { precision = 60 * 1000 } = opts || {};
	// 		const dateCheckMillis = date.getTime() - precision;
	//
	// 		expect(updatedAtMillis).toBeGreaterThan(dateCheckMillis);
	// 	};

	// const statePicker = (): StatePickerInterface => {
	// 	return getStatePicker(container);
	// };

	// const scanField = (): ScanFieldInterface => getScanField(container);

	// const entries = (view: ViewName) => getEntriesTable(view, container);

	// const discount = () => getDiscount(container);

	// return Object.assign(container, { heading, updatedAt, assertUpdatedAt, statePicker, scanField, entries, discount });
	return Object.assign(container, { header });
}

function getHeader(content: Locator): ContentHeaderInterface {
	const container = content.locator("header");

	const titleElement = container.locator("h1");

	const title = () => ({
		assert: (text: string, opts?: WaitForOpts) =>
			titleElement.getByText(text, { exact: true }).waitFor({ timeout: assertionTimeout, ...opts })
	});

	return Object.assign(container, { title });
}

// function getStatePicker(content: Locator): StatePickerInterface {
// 	const container = content.locator("#note-state-picker");
//
// 	const getState = (opts?: WaitForOpts) =>
// 		container.locator("#current-value").getAttribute("data-value", { timeout: assertionTimeout, ...opts }) as Promise<
// 			NoteState | NoteTempState
// 		>;
//
// 	const assertState = (state: NoteState | NoteTempState, opts?: WaitForOpts) =>
// 		container.locator(`#current-value[data-value="${state}"]`).waitFor({ timeout: assertionTimeout, ...opts });
//
// 	// const { open } = useExpandButton(container);
//
// 	const select = async (newState: NoteState) => {
// 		const currentState = await getState();
//
// 		if (currentState === newState) {
// 			return;
// 		}
//
// 		await open();
//
// 		await container.locator(`[data-option="${newState}"]`).click();
// 	};
//
// 	return Object.assign(container, { getState, assertState, select });
// }

// function getScanField(content: Locator): ScanFieldInterface {
// 	const container = content.locator("#scan-input-container");
// 	const input = container.locator("input");
//
// 	const add = async (isbn: string) => {
// 		await input.fill(isbn);
// 		await input.press("Enter");
// 	};
//
// 	return Object.assign(input, { add });
// }
//
// function getDiscount(container: Locator) {
// 	const locator = container.getByRole("spinbutton");
//
// 	const set = async (value: number) => {
// 		await locator.focus();
// 		await locator.fill(value.toString());
// 		await locator.press("Enter");
// 	};
//
// 	return Object.assign(locator, { set });
// }
