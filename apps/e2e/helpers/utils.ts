import { Locator, expect } from "@playwright/test";

import { assertionTimeout } from "@/constants";
import { EntityListView, TestId, WebClientView } from "@librocco/shared";

export async function compareEntries(container: Locator, labels: string[], selector: string, opts?: { timeout?: number }) {
	for (let i = 0; i <= labels.length; i++) {
		// Instead of checking (statically) for the length of elements to match and retry until they do,
		// we're using the built-in retries (of (Locator).waitFor) and expecting the element of n+1 to be detached (verifying there aren't more elements than wanted).
		//
		// If there are fewer elements than in the wanted list of labels, if will be caught by the `expect` assertion below.
		if (i === labels.length) {
			await container
				.locator(selector)
				.nth(i)
				.waitFor({ timeout: assertionTimeout, ...opts, state: "detached" });
		} else {
			await expect(container.locator(selector).nth(i)).toHaveText(labels[i], { timeout: assertionTimeout, ...opts });
		}
	}
}

// #region selectors
type IdString = `#${string}`;
type ClassString = `.${string}`;
type TestIdString = `[data-testid="${string}"]`;
type DataLoadedString = `[data-loaded="${boolean}"]`;
type DataViewString = `[data-view="${string}"]`;

type SelectorSegment = IdString | ClassString | TestIdString | DataLoadedString | DataViewString;

/** Creates a typo-safe selector string for the element id */
export const idSelector = (_id: TestId): IdString => `#${_id}`;
/** Creates a typo-safe selector string for the element class name */
export const classSelector = (_id: TestId): ClassString => `.${_id}`;
/** Creates a typo-safe selector string for the element testid = [data-testid="..."] */
export const testIdSelector = (_id: TestId): TestIdString => `[data-testid="${_id}"]`;
/** Creates a typo-safe selector string for the loaded element - [data-loaded="..."] */
export const loadedSelector = (_loaded: boolean): DataLoadedString => `[data-loaded="${_loaded}"]`;
/** Creates a typo-safe selector string for the view element - [data-view="..."] */
export const viewSelector = (_view: WebClientView): DataViewString => `[data-view="${_view}"]`;
/** Creates a typo-safe selector string for the entity list view element - [data-view="..."] */
export const entityListViewSelector = (_view: EntityListView): DataViewString => `[data-view="${_view}"]`;

/** Accepts typo-safe selector segments and joins them in to the selector string */
export const selector = (...segments: SelectorSegment[]): string => segments.join("");
// #endregion selectors
