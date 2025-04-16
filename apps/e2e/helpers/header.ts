import { ContentHeaderInterface, DashboardNode, WaitForOpts } from "./types";

import { assertionTimeout } from "../constants";

import { getDateString } from "./dateString";
import { getBreadcrumbs } from "./breadcrumbs";

export function getHeader(_parent: DashboardNode): ContentHeaderInterface {
	const dashboard = _parent.dashboard;
	// * The following is a quick fix to allow existing tests to pass without having to refactor them heavily
	// "header" used to "Object.assign(_parent.locator("header"), {});"
	// But the updated PageLayout has been simplified to only have one "main" slot
	// under which everything in the main body of the app is composed on each page
	// This means the "header" selector will no longer find anything, and the easiest way to handle this
	// is to not select too specifically, but just continue with nested selectors/methods from the dashboard node
	const header = dashboard();

	const breadcrumbs = () => getBreadcrumbs(getHeader(_parent));

	const titleElement = header.locator("h1");

	const title = () => ({
		assert: (text: string, opts?: WaitForOpts) =>
			titleElement.getByText(text, { exact: true }).waitFor({ timeout: assertionTimeout, ...opts })
	});

	const extractDateFromUpdatedAtString = (str: string) => new Date(str.replace("Updated: ", ""));
	const updatedAt = () => getDateString(getHeader(_parent), "Updated:", extractDateFromUpdatedAtString);

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

	const commit = async (opts: WaitForOpts = {}) => header.getByText("Commit").click({ timeout: assertionTimeout, ...opts });

	return Object.assign(header, {
		dashboard,
		title,
		breadcrumbs,
		updatedAt,
		createNote,
		createWarehouse,
		commit
	});
}
