import { DashboardNode } from "./types";
import { selector, testIdSelector } from "./utils";

type DropdownInterface = DashboardNode<{
	open(): Promise<void>;
	close(): Promise<void>;
	opened<F extends () => Promise<any>>(fn: F): F;
}>;

export function getDropdown(parent: DashboardNode): DropdownInterface {
	const dashboard = parent.dashboard;

	const page = dashboard().page();

	// Dropdown control button
	const control = parent.locator(selector(testIdSelector("dropdown-control")));

	// Note: container will be present only if the dropdown is open
	//
	// We're matching the dropdown menu from the root node (page) as it'a portalled to the end of the HTML
	const container = page.locator(selector(testIdSelector("dropdown-menu")));

	// We could, in theory, use the 'waitFor' (and 'waitFor({ state: "detached" })') for the checks,
	// but that would be an assertion and can't be used (error-safe) for mere (soft) checks
	const isOpen = () => control.getAttribute("data-open").then((value) => value === "true");

	const open = async () => {
		// Noop if the dropdown is already open
		if (await isOpen()) return;
		await control.click();
		return container.waitFor();
	};

	const close = async () => {
		// Noop if the dropdown is already closed
		if (!(await isOpen())) return;
		await control.click();
		return container.waitFor({ state: "detached" });
	};

	const opened = <F extends () => Promise<any>>(fn: F): F =>
		(async () => {
			await open();
			return fn();
		}) as F;

	return Object.assign(container, { dashboard, open, close, opened });
}
