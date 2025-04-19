import { Locator, expect } from "@playwright/test";

import { assertionTimeout } from "@/constants";
import { EntityListView, TestId, WebClientView } from "@librocco/shared";
import { FieldConstructor, WaitForOpts } from "./types";

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
type TestIdString = `[data-testid="${string}"]` | `[data-testid*="${string}"]`;
type DataViewString = `[data-view="${string}"]` | `[data-view*="${string}"]`;
type DataValueString = `[data-value="${string}"]` | `[data-value*="${string}"]`;

type SelectorSegment = IdString | ClassString | TestIdString | DataViewString | DataValueString;

type SelectorConstructor<I, T extends SelectorSegment> = (input: I, opts?: { strict: boolean }) => T;

/** Creates a typo-safe selector string for the element id */
export const idSelector: SelectorConstructor<TestId, IdString> = (_id) => `#${_id}`;
/** Creates a typo-safe selector string for the element class name */
export const classSelector: SelectorConstructor<TestId, ClassString> = (_id) => `.${_id}`;
/** Creates a typo-safe selector string for the element testid = [data-testid="..."] */
export const testIdSelector: SelectorConstructor<TestId, TestIdString> = (_id, { strict } = { strict: true }) =>
	strict ? `[data-testid="${_id}"]` : `[data-testid*="${_id}"]`;
/** Creates a typo-safe selector string for the view element - [data-view="..."] */
export const viewSelector: SelectorConstructor<WebClientView, DataViewString> = (_view, { strict } = { strict: true }) =>
	strict ? `[data-view="${_view}"]` : `[data-view*="${_view}"]`;
/** Creates a typo-safe selector string for the entity list view element - [data-view="..."] */
export const entityListViewSelector: SelectorConstructor<EntityListView, DataViewString> = (_view, { strict } = { strict: true }) =>
	strict ? `[data-view="${_view}"]` : `[data-view*="${_view}"]`;
/** Creates a typo-safe selector string for the data-value element */
export const dataValueSelector: SelectorConstructor<string, DataValueString> = (_view, { strict } = { strict: true }) =>
	strict ? `[data-value="${_view}"]` : `[data-value*="${_view}"]`;

export const conditionalSelector = (segment?: SelectorSegment, condition = false): SelectorSegment =>
	condition ? segment : ("" as SelectorSegment);
/** Accepts typo-safe selector segments and joins them in to the selector string */
export const selector = (...segments: SelectorSegment[]): string => segments.join("");
// #endregion selectors

// #region assertions
export const stringFieldConstructor =
	<L extends Record<string, any>, K extends keyof L>(
		name: K,
		transformDisplay: (x: string) => string | RegExp = (x: string) => x
	): FieldConstructor<L, K> =>
	(parent: Locator) =>
		({
			assert: (want: K, opts?: WaitForOpts) =>
				expect(parent.locator(`[data-property="${name as string}"]`)).toHaveText(transformDisplay(want.toString()), {
					timeout: assertionTimeout,
					...opts
				})
		}) as L[K];
// #endregion assertions
