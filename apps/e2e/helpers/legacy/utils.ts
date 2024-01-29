import { type Locator, expect } from "@playwright/test";

import { WaitForOpts } from "./types";

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

/**
 * Use expand button provides and interface to interact with the expandable field, which is expanded and closed using the
 * button with the aria-expanded attribute.
 *
 * It accepts the `container` locator and optional `opts` object.
 *
 * @param container the locator for the element containing the expand button (and the expandable field)
 * @param opts (optional) options object
 * @param opts.throttle sometimes we want to interact with the opening/closing of the expanded field a couple of times in a row.
 * This can get blocked as it doesn't allow the DOM enough time to update, which causes weird failures in tests. In those cases we
 * use the `throttle` option to add a timeout after the operation (open/close) is done to allow the DOM some time to update for the next interaction.
 */
export const useExpandButton = (container: Locator, opts: { throttle?: number } = { throttle: 0 }) => {
	const { throttle = 0 } = opts;

	const getExpandButton = (state?: "open" | "closed") => {
		switch (state) {
			case "open":
				return container.locator("button[aria-expanded=true]");
			case "closed":
				return container.locator("button[aria-expanded=false]");
			default:
				return container.locator("button");
		}
	};

	const open = async (opts?: WaitForOpts) => {
		try {
			// If the dropdown is closed, open it
			const button = getExpandButton("closed");
			await button.waitFor({ timeout: 500 });
			await button.click();
		} catch {
			// Already open (noop)
		} finally {
			// Ensure the dropdown is open
			await getExpandButton("open").waitFor({ timeout: assertionTimeout, ...opts });
			await container.page().waitForTimeout(throttle);
		}
	};

	const close = async (opts?: WaitForOpts) => {
		try {
			// If the dropdown is open, close it
			const button = getExpandButton("open");
			await button.waitFor({ timeout: 500 });
			await button.click();
		} catch {
			// Already closed (noop)
		} finally {
			// Ensure the dropdown is closed
			await getExpandButton("closed").waitFor({ timeout: assertionTimeout, ...opts });
			await container.page().waitForTimeout(throttle);
		}
	};

	return { open, close, getExpandButton };
};
