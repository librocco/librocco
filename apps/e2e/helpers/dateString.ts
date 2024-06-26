import { expect } from "@playwright/test";

import { DashboardNode, WaitForOpts, UpdatedAtInterface } from "./types";

import { assertionTimeout } from "@/constants";

export function getDateString(parent: DashboardNode, prefix: string, extractDate: (str: string) => Date): UpdatedAtInterface {
	const dashboard = parent.dashboard;

	const container = parent.getByText(prefix);

	const value = async (opts: WaitForOpts = {}) => {
		await container.waitFor({ timeout: assertionTimeout, ...opts });

		const matchedString = await container.evaluate((element) => element.textContent, null, {
			timeout: assertionTimeout,
			...opts
		});

		return extractDate(matchedString);
	};

	const assert = async (want: Date | string, opts: WaitForOpts & { precision?: number } = {}) => {
		// Get the value of the date element
		const dateMillis = await value(opts).then((date) => date.getTime());
		// Without mocking the date, we can't assert the exact date, but we can expect the date element value to be close to the want date
		const wantDate = typeof want === "string" ? new Date(want) : want;
		// In practice, this should happen a lot faster than 90 seconds (even much faster than a minute), but
		// the date label (most often) rounds down on minutes, so we're accounting for the rounding error + some time between the update and the assertion
		const { precision = 90 * 1000 } = opts;
		const wantMillis = wantDate.getTime() - precision;
		expect(dateMillis).toBeGreaterThan(wantMillis);
	};

	return Object.assign(container, { dashboard, value, assert });
}
