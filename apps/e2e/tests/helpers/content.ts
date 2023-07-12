import { type Locator, type Page, expect } from "@playwright/test";

import type { ViewInterface, WaitForOpts, ContentInterface, ContentHeadingInterface, StatePickerInterface, GetByTextOpts } from "./types";

export class Content implements ContentInterface {
	#page: Page;
	#view: ViewInterface;

	container: Locator;

	constructor(page: Page, view: ViewInterface) {
		this.#page = page;
		this.#view = view;

		this.container = page.locator("#table-section");
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}

	heading(title?: string, opts?: GetByTextOpts): ContentHeadingInterface {
		return new ContentHeading(this.#page, this, title, opts);
	}

	async updatedAt(): Promise<Date> {
		const updatedAtElement = this.container.getByText("Last updated:");
		await updatedAtElement.waitFor();

		const updatedAtString = await updatedAtElement.evaluate((element) => element.textContent);

		return new Date(
			updatedAtString
				// Replace the " at " separator (webkit formatted date) to a regular date string
				.replace(" at ", ", ")
				.replace("Last updated: ", "")
		);
	}

	async assertUpdatedAt(date: Date): Promise<void> {
		const updatedAt = await this.updatedAt();
		const updatedAtMillis = updatedAt.getTime();

		// Without mocking the date, we can't assert the exact date, but we can expect the updated at to be under a minute from now
		const dateMillis = date.getTime() - 60 * 1000;

		expect(dateMillis).toBeLessThan(updatedAtMillis);
	}

	statePicker(): StatePickerInterface {
		return new StatePicker(this.#page, this);
	}
}

class ContentHeading implements ContentHeadingInterface {
	#page: Page;
	#content: ContentInterface;

	container: Locator;

	constructor(page: Page, content: ContentInterface, title?: string, opts?: GetByTextOpts) {
		const heading = content.container.getByRole("heading", opts);
		this.container = title ? heading.getByText(title) : heading.locator("p");
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}

	textContent(opts: { timeout?: number } = { timeout: 500 }) {
		return (
			this.container
				.textContent(opts)
				// If there's an error (the heading probably isn't visible, fall back to empty string)
				.catch(() => "")
		);
	}
}

class StatePicker implements StatePickerInterface {
	#page: Page;
	#content: ContentInterface;

	container: Locator;

	constructor(page: Page, content: ContentInterface) {
		this.#page = page;
		this.#content = content;

		this.container = page.locator("#note-state-picker");
	}

	waitFor(opts?: WaitForOpts) {
		return this.container.waitFor(opts);
	}
}
