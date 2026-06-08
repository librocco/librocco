import type { DashboardNode } from "./types";
import { selector, testIdSelector } from "./utils";
import { assertionTimeout } from "@/constants";

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
		// The control lives in a list row that can be detached/re-rendered while its data settles (e.g.
		// right after an in-app navigation or a burst of writes). Wait for it to be present first, so a
		// mid-render interaction fails fast (and is retried) instead of letting the unbounded
		// getAttribute/click below auto-wait the entire per-test timeout budget -> "Test timeout exceeded".
		await control.waitFor({ state: "visible", timeout: assertionTimeout });
		// Noop if the dropdown is already open
		if (await isOpen()) return;
		await control.click();
		return container.waitFor({ timeout: assertionTimeout });
	};

	const close = async () => {
		// Noop if the dropdown is already closed
		if (!(await isOpen())) return;
		await control.click();
		return container.waitFor({ state: "detached", timeout: assertionTimeout });
	};

	const opened = <F extends () => Promise<any>>(fn: F): F =>
		(async () => {
			await open();
			return fn();
		}) as F;

	return Object.assign(container, { dashboard, open, close, opened });
}
