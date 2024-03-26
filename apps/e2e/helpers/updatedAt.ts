import { expect } from "@playwright/test";

import { DashboardNode, WaitForOpts, UpdatedAtInterface } from "./types";

import { assertionTimeout } from "@/constants";

export function getUpdatedAt(parent: DashboardNode): UpdatedAtInterface {
	const dashboard = parent.dashboard;

	const container = parent.getByText("Last updated:");

	const value = async (opts: WaitForOpts = {}) => {
		await container.waitFor({ timeout: assertionTimeout, ...opts });

		const updatedAtString = await container.evaluate((element) => element.textContent, null, {
			timeout: assertionTimeout,
			...opts
		});

		return new Date(
			updatedAtString
				// Replace the " at " separator (webkit formatted date) to a regular date string
				.replace(" at ", ", ")
				.replace("Last updated: ", "")
		);
	};

	const assert = async (want: Date | string, opts: WaitForOpts & { precision?: number } = {}) => {
		// Get the value of the 'updatedAt' element
		const updatedAtMillis = await value(opts).then((date) => date.getTime());

		// Without mocking the date, we can't assert the exact date, but we can expect the 'updatedAt' to be close to the want date
		const wantDate = typeof want === "string" ? new Date(want) : want;
		// In practice, this should happen a lot faster than 90 seconds (even much faster than a minute), but
		// the updated at label rounds down on minutes, so we're accounting for the rounding error + some time between the update and the assertion
		const { precision = 90 * 1000 } = opts;
		const wantMillis = wantDate.getTime() - precision;

		expect(updatedAtMillis).toBeGreaterThan(wantMillis);
	};

	return Object.assign(container, { dashboard, value, assert });
}
