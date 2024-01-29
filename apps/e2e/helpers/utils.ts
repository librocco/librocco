import { Locator, expect } from "@playwright/test";

import { assertionTimeout } from "@/constants";

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
