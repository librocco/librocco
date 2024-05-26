import { redirect } from "@sveltejs/kit";
import { fromDate, getLocalTimeZone } from "@internationalized/date";

import type { PageLoad } from "./$types";

import { appPath } from "$lib/paths";

export const load: PageLoad = async ({ params: { date } }) => {
	// Validate the date - if not valid, redirect to default
	if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
		throw redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
	}

	// Prepare the date for usage with date picker
	const dateValue = fromDate(new Date(date), getLocalTimeZone());

	return { date, dateValue };
};
