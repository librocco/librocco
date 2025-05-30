import { EntityListView } from "@librocco/shared";

import { DashboardNode, EntityListInterface, EntityListItem, EntityListMatcher, WaitForOpts, WarehouseItemDropdown } from "./types";

import { assertionTimeout } from "@/constants";

import { getDateString } from "./dateString";
import { classSelector, entityListViewSelector, selector } from "./utils";
import { getDropdown } from "./dropdown";

export function getEntityList(_parent: DashboardNode, view: EntityListView): EntityListInterface {
	const dashboard = _parent.dashboard;
	const container = _parent.locator(selector(classSelector("entity-list-container"), entityListViewSelector(view)));

	async function assertElement(element: null, nth: number): Promise<void>;
	async function assertElement(element: EntityListMatcher, nth?: number): Promise<void>;
	async function assertElement(element: EntityListMatcher | null, nth?: number): Promise<void> {
		let locator = container.locator(".entity-list-row");
		// If nth provided, we're explicitly checking for the nth element, otherwise, we're checking that the element exists
		locator = nth !== undefined ? locator.nth(nth) : locator;

		// If element is null, we're asserting that it doesn't exist. This is helpful in cases where we want to assert that there
		// are no more elements (than specified) in a list (when asserting for the entire list)
		if (element === null) return locator.waitFor({ state: "detached" });

		const { name, updatedAt, numBooks, discount, totalCoverPrice, totalDiscountedPrice } = element;

		if (name) await locator.getByText(name, { exact: true }).waitFor();
		if (updatedAt) {
			const extractDateFromUpdatedAtString = (str: string) => new Date(str.replace("Updated: ", ""));
			await getDateString(Object.assign(locator, { dashboard: _parent.dashboard }), "Updated:", extractDateFromUpdatedAtString).assert(
				updatedAt
			);
		}

		if (numBooks) await locator.getByText(`${numBooks} books`).waitFor();
		if (discount) await locator.getByText(`${discount}% discount`).waitFor();
		if (totalCoverPrice) await locator.getByText(`Total cover price: ${totalCoverPrice.toFixed(2)}`).waitFor();
		if (totalDiscountedPrice) await locator.getByText(`Total discounted price: ${totalDiscountedPrice.toFixed(2)}`).waitFor();
	}

	async function assertElements(elements: EntityListMatcher[]): Promise<void> {
		// Assert that there are no more than required elements (last element + 1 should be null)
		await assertElement(null, elements.length);
		await Promise.all(elements.map(assertElement));
	}

	const item = (nth: number) => getEntityListItem(getEntityList(_parent, view), nth);

	return Object.assign(container, { dashboard, assertElement, assertElements, item });
}

function getEntityListItem(parent: DashboardNode, nth: number): EntityListItem {
	const dashboard = parent.dashboard;
	const container = parent.locator(".entity-list-row").nth(nth);

	const edit = () => container.getByText("Edit").click();
	const _delete = () => container.locator('button[aria-label*="Delete note"]').click();

	const dropdown = () => getWarehouseDropdown(getEntityListItem(parent, nth));

	const createNote = async (opts: WaitForOpts = {}) => {
		// Create a new note by clicking the button
		await container.getByRole("button", { name: "New Purchase" }).click();
		// Wait for the outbound note view to load (signaling that we've been successfully redirected and can continue with the test)
		await dashboard()
			.view("inbound-note")
			.waitFor({ timeout: assertionTimeout, ...opts });
	};

	return Object.assign(container, { dashboard, edit, delete: _delete, dropdown, createNote });
}

function getWarehouseDropdown(parent: DashboardNode): WarehouseItemDropdown {
	const dropdown = getDropdown(parent);
	const opened = dropdown.opened;

	const edit = opened(() => dropdown.getByText("Edit").click());
	const viewStock = opened(() => dropdown.getByText("View Stock").click());
	const _delete = opened(() => dropdown.getByText("Delete").click());

	return Object.assign(dropdown, { edit, viewStock, delete: _delete });
}
