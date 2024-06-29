import { fromDate, getLocalTimeZone } from "@internationalized/date";
import { redirect } from "@sveltejs/kit";

import type { LayoutLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: LayoutLoad = async ({ params }) => {
	const { warehouseId, from: _from, to: _to } = params;
	console.log("warehoseId:", warehouseId);
	console.log("from:", _from);
	console.log("to:", _to);

	// Validate dates - if not valid, redirect to default
	if (!_from || !_to || ![_from, _to].every((date) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))) {
		const today = new Date().toISOString().slice(0, 10);
		// We're passing _from and _to as [...warehouseId] might get broken up into segments wrongly recognised as _from and _to
		// note: any undefined value in the `appPath`s route params will simply be omitted
		throw redirect(307, appPath("history/warehouse", warehouseId, _from, _to, today, today));
	}

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
