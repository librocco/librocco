import { fromDate, getLocalTimeZone } from "@internationalized/date";

import { TestId } from "@librocco/shared";

import type { CalendarPicker, DashboardNode } from "./types";

import { conditionalSelector, dataValueSelector, selector, testIdSelector } from "./utils";

export function getCalendar(parent: DashboardNode, id?: TestId): CalendarPicker {
	const dashboard = parent.dashboard;

	// Dropdown control button
	const control = parent.locator(
		selector(conditionalSelector(`[data-calendarid=${id}]` as any, Boolean(id)), testIdSelector("calendar-picker-control"))
	);

	// Note: container will be present only if the calendar picker is open
	//
	// We're matching the dropdown menu from the root node (page) as it'a portalled to the end of the HTML
	const container = parent.page().locator(selector(testIdSelector("calendar-picker")));

	const monthPicker = () => getMonthPicker(getCalendar(parent));

	// We could, in theory, use the 'waitFor' (and 'waitFor({ state: "detached" })') for the checks,
	// but that would be an assertion and can't be used (error-safe) for mere (soft) checks
	const isOpen = () => control.getAttribute("data-open").then((value) => value === "true");

	const open = async () => {
		// Noop if the picker is already open
		if (await isOpen()) return;
		await control.click();
		return container.waitFor();
	};

	const close = async () => {
		// Noop if the picker is already closed
		if (!(await isOpen())) return;
		await parent.page().keyboard.press("Escape");
		return container.waitFor({ state: "detached" });
	};

	// A helper wrapper used for operations that require the picker to be open
	const opened = <F extends (...params: any[]) => Promise<any>>(fn: F): F =>
		(async (...params: Parameters<F>) => {
			await open();
			return fn(...params);
		}) as F;

	const selectMonth = opened((date: string) => monthPicker().select(date));
	const selectDay = opened((date: string) => container.locator(selector(dataValueSelector(date, { strict: false }))).click());
	const select = async (date: string) => {
		await selectMonth(date);
		await selectDay(date);
		await close();
	};

	return Object.assign(container, { dashboard, open, close, select });
}

interface MonthPicker extends DashboardNode {
	next(): Promise<void>;
	prev(): Promise<void>;
	select(date: string): Promise<void>;
}

function getMonthPicker(parent: DashboardNode): MonthPicker {
	const dashboard = parent.dashboard;

	const locator = parent.locator(selector(testIdSelector("calendar-picker-month-select")));

	const prev = () => locator.getByRole("button").first().click();
	const next = () => locator.getByRole("button").last().click();

	const value = () => locator.evaluate((node) => node.textContent).then((txt) => fromDate(new Date(txt), getLocalTimeZone()));

	const select = async (date: string) => {
		const target = fromDate(new Date(date), getLocalTimeZone());
		const current = await value();

		const yearDiff = target.year - current.year;
		const monthDiff = yearDiff * 12 + (target.month - current.month);

		for (let i = 0; i < Math.abs(monthDiff); i++) {
			await (monthDiff > 0 ? next : prev)();
		}
	};

	return Object.assign(locator, { dashboard, prev, next, select });
}
