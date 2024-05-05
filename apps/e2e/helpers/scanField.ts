import { expect } from "@playwright/test";
import { DashboardNode, ScanFieldInterface } from "./types";

import { selector, testIdSelector } from "./utils";

export function getScanField(parent: DashboardNode): ScanFieldInterface {
	const dashboard = parent.dashboard;
	const input = parent.locator(selector(testIdSelector("scan-input")));

	const add = async (isbn: string) => {
		await input.fill(isbn);
		await input.press("Enter");
	};

	const { toggleOn, toggleOff } = scanToggleButton(parent);

	return Object.assign(input, { dashboard, add, toggleOn, toggleOff });
}

const scanToggleButton = (parent: DashboardNode) => {
	const dashboard = parent.dashboard;
	const button = dashboard()
		.content()
		.locator(selector(testIdSelector("scan-autofocus-toggle")));

	const isOn = () => button.getAttribute("data-is-on").then((value) => value === "true");

	const toggleOn = async () => {
		// Noop if the autofocus is already on
		if (await isOn()) return;
		await button.click();
		return expect(button).toHaveAttribute("data-is-on", "true");
	};

	const toggleOff = async () => {
		// Noop if the autofocus is already on
		if (!(await isOn())) return;
		await button.click();
		return expect(button).toHaveAttribute("data-is-on", "false");
	};

	return Object.assign(button, { dashboard, toggleOn, toggleOff });
};
