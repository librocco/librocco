import { redirect } from "@sveltejs/kit";
import { fromDate, getLocalTimeZone } from "@internationalized/date";

import type { PageLoad } from "./$types";
import type { PastNoteItem } from "$lib/db/cr-sqlite/types";

import { appPath } from "$lib/paths";
import { getPastNotes } from "$lib/db/cr-sqlite/history";

export const load: PageLoad = async ({ params: { date }, parent, depends }) => {
	depends("history:notes");

	const { dbCtx } = await parent();

	// Validate the date - if not valid, redirect to default
	if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
		redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
	}

	// Prepare the date for usage with date picker
	const dateValue = fromDate(new Date(date), getLocalTimeZone());

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { date, dateValue, notes: [] as PastNoteItem[] };
	}

	const notes = await getPastNotes(dbCtx.db, date);
	return { date, dateValue, notes };
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DailySummaryStore {}
