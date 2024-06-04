import { fromDate, getLocalTimeZone } from "@internationalized/date";
import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: LayoutLoad = async ({ params }) => {
	const warehouseId = params.warehouse;

	const dateRange = params.params.split("/").filter(Boolean); // Remove the empty "" as the last segment of a path with trailing a slash

	// Validate dates - if not valid, redirect to default
	if (dateRange?.length !== 2 || !dateRange?.every((date) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))) {
		const today = new Date().toISOString().slice(0, 10);
		throw redirect(307, appPath("history/warehouse", warehouseId, today, today));
	}

	const [_from, _to] = dateRange;
	const from = {
		date: _from,
		dateValue: fromDate(new Date(_from), getLocalTimeZone())
	};
	const to = {
		date: _to,
		dateValue: fromDate(new Date(_to), getLocalTimeZone())
	};

	return { warehouseId, to, from };
};
