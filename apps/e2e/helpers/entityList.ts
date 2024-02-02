import { DashboardNode, EntityListInterface, EntityListMatcher } from "./types";

import { getUpdatedAt } from "./updatedAt";

export function getEntityList(_parent: DashboardNode): EntityListInterface {
	const dashboard = _parent.dashboard;
	const container = _parent.locator("ul#entity-list");

	async function assertElement(element: null, nth: number): Promise<void>;
	async function assertElement(element: EntityListMatcher, nth?: number): Promise<void>;
	async function assertElement(element: EntityListMatcher | null, nth?: number): Promise<void> {
		let locator = container.locator("li");
		// If nth provided, we're explicitly checking for the nth element, otherwise, we're checking that the element exists
		locator = nth !== undefined ? locator.nth(nth) : locator;

		// If element is null, we're asserting that it doesn't exist. This is helpful in cases where we want to assert that there
		// are no more elements (than specified) in a list (when asserting for the entire list)
		if (element === null) return locator.waitFor({ state: "detached" });

		const { name, updatedAt, numBooks } = element;

		if (name) await locator.getByText(name, { exact: true }).waitFor();
		if (updatedAt) await getUpdatedAt(Object.assign(locator, { dashboard })).assert(updatedAt);
		if (numBooks) await locator.getByText(`${numBooks} books`).waitFor();
	}

	async function assertElements(elements: EntityListMatcher[]): Promise<void> {
		for (let i = 0; i <= elements.length; i++) {
			// For the element after the last, we're asserting that there are no more elements in the list.
			// This is a more Playwright-friendly way of asserting the list than checking for length explicitly.
			const element = i === elements.length ? null : elements[i];
			await assertElement(element, i);
		}
	}

	function item(nth: number) {
		const locator = container.locator("li").nth(nth);

		const edit = () => locator.getByText("Edit").click();
		const _delete = () => locator.locator('button[aria-label*="Delete note"]').click();

		return Object.assign(locator, { dashboard, edit, delete: _delete });
	}

	return Object.assign(container, { dashboard, assertElement, assertElements, item });
}
