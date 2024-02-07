import { DashboardNode, ScanFieldInterface } from "./types";

import { selector, testIdSelector } from "./utils";

export function getScanField(parent: DashboardNode): ScanFieldInterface {
	const dashboard = parent.dashboard;
	const input = parent.locator(selector(testIdSelector("scan-input")));

	const add = async (isbn: string) => {
		await input.fill(isbn);
		await input.press("Enter");
	};

	return Object.assign(input, { dashboard, add });
}
