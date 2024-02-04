import { ContentHeaderInterface, DashboardNode, WaitForOpts } from "./types";

import { assertionTimeout } from "../constants";

import { getUpdatedAt } from "./updatedAt";
import { getBreadcrumbs } from "./breadcrumbs";

export function getHeader(_parent: DashboardNode): ContentHeaderInterface {
	const dashboard = _parent.dashboard;
	const header = Object.assign(_parent.locator("header"), {});

	const createNote = async (opts: WaitForOpts = {}) => {
		// Create a new note by clicking the button
		await header.getByRole("button", { name: "New note" }).click();
		// Wait for the outbound note view to load (signaling that we've been successfully redirected and can continue with the test)
		await dashboard()
			.view("outbound-note")
			.waitFor({ timeout: assertionTimeout, ...opts });
	};

	const createWarehouse = async (opts: WaitForOpts = {}) => {
		// Create a new note by clicking the button
		await header.getByRole("button", { name: "New warehouse" }).click();
		// Wait for the outbound note view to load (signaling that we've been successfully redirected and can continue with the test)
		await dashboard()
			.view("warehouse")
			.waitFor({ timeout: assertionTimeout, ...opts });
	};

	const breadcrumbs = () => getBreadcrumbs(getHeader(_parent));

	const titleElement = header.locator("h1");

	const title = () => ({
		assert: (text: string, opts?: WaitForOpts) =>
			titleElement.getByText(text, { exact: true }).waitFor({ timeout: assertionTimeout, ...opts })
	});

	const updatedAt = () => getUpdatedAt(getHeader(_parent));

	return Object.assign(header, {
		dashboard,
		title,
		createNote,
		createWarehouse,
		breadcrumbs,
		updatedAt
	});
}
