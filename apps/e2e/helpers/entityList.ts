import { EntityListView } from "@librocco/shared";

import { DashboardNode, EntityListInterface, EntityListItem, EntityListMatcher, WarehouseItemDropdown } from "./types";

import { getUpdatedAt } from "./updatedAt";
import { classSelector, entityListViewSelector, loadedSelector, selector, testIdSelector } from "./utils";

export function getEntityList(_parent: DashboardNode, view: EntityListView): EntityListInterface {
	const dashboard = _parent.dashboard;
	const container = _parent.locator(selector(classSelector("entity-list-container"), entityListViewSelector(view), loadedSelector(true)));

	async function assertElement(element: null, nth: number): Promise<void>;
	async function assertElement(element: EntityListMatcher, nth?: number): Promise<void>;
	async function assertElement(element: EntityListMatcher | null, nth?: number): Promise<void> {
		let locator = container.locator("li");
		// If nth provided, we're explicitly checking for the nth element, otherwise, we're checking that the element exists
		locator = nth !== undefined ? locator.nth(nth) : locator;

		// If element is null, we're asserting that it doesn't exist. This is helpful in cases where we want to assert that there
		// are no more elements (than specified) in a list (when asserting for the entire list)
		if (element === null) return locator.waitFor({ state: "detached" });

		const { name, updatedAt, numBooks, discount } = element;

		if (name) await locator.getByText(name, { exact: true }).waitFor();
		if (updatedAt) await getUpdatedAt(Object.assign(locator, { dashboard })).assert(updatedAt);
		if (numBooks) await locator.getByText(`${numBooks} books`).waitFor();
		if (discount) await locator.getByText(`${discount}% discount`).waitFor();
	}

	async function assertElements(elements: EntityListMatcher[]): Promise<void> {
		for (let i = 0; i <= elements.length; i++) {
			// For the element after the last, we're asserting that there are no more elements in the list.
			// This is a more Playwright-friendly way of asserting the list than checking for length explicitly.
			const element = i === elements.length ? null : elements[i];
			await assertElement(element, i);
		}
	}

	const item = (nth: number) => getEntityListItem(getEntityList(_parent, view), nth);

	return Object.assign(container, { dashboard, assertElement, assertElements, item });
}

function getEntityListItem(parent: DashboardNode, nth: number): EntityListItem {
	const dashboard = parent.dashboard;
	const container = parent.locator("li").nth(nth);

	const edit = () => container.getByText("Edit").click();
	const _delete = () => container.locator('button[aria-label*="Delete note"]').click();

	const dropdown = () => getWarehouseDropdown(getEntityListItem(parent, nth));

	return Object.assign(container, { dashboard, edit, delete: _delete, dropdown });
}

function getWarehouseDropdown(parent: DashboardNode): WarehouseItemDropdown {
	const dashboard = parent.dashboard;

	const page = dashboard().page();

	// Dropdown control button
	const control = parent.locator(selector(testIdSelector("dropdown-control")));

	// Note: container will be present only if the dropdown is open
	//
	// We're matching the dropdown menu from the root node (page) as it'a portalled to the end of the HTML
	const container = page.locator(selector(testIdSelector("dropdown-menu")));

	// We could, in theory, use the 'waitFor' (and 'waitFor({ state: "detached" })') for the checks,
	// but that would be an assertion and can't be used (error-safe) for mere (soft) checks
	const isOpen = () => control.getAttribute("data-open").then((value) => value === "true");

	const open = async () => {
		// Noop if the dropdown is already open
		if (await isOpen()) return;
		await control.click();
		return container.waitFor();
	};

	const close = async () => {
		// Noop if the dropdown is already closed
		if (!(await isOpen())) return;
		await control.click();
		return container.waitFor({ state: "detached" });
	};

	const opened = (fn: () => Promise<any>) => async () => {
		await open();
		return fn();
	};

	const edit = opened(() => container.getByText("Edit").click());
	const viewStock = opened(() => container.getByText("View Stock").click());
	const _delete = opened(() => container.getByText("Delete").click());

	return Object.assign(container, { dashboard, open, close, edit, viewStock, delete: _delete });
}
