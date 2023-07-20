import { type Locator, expect } from "@playwright/test";

import { zip, testUtils } from "@librocco/shared";

export async function compareEntries(container: Locator, labels: string[], selector: string) {
	return testUtils.waitFor(async () => {
		const elements = await container.locator(selector).all();

		expect(elements.length).toBe(labels.length);

		if (elements.length === 0) {
			return;
		}

		for (const [link, label] of zip(elements, labels)) {
			await expect(link).toHaveText(label);
		}
	});
}
