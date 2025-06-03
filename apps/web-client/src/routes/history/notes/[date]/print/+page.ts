import type { PageLoad } from "./$types";
import { getPastNotes } from "$lib/db/cr-sqlite/history";
import { timed } from "$lib/utils/timer";
import { fromDate, getLocalTimeZone } from "@internationalized/date";
import { redirect } from "@sveltejs/kit";
import { appPath } from "$lib/paths";
import type { PastNoteItem } from "$lib/db/cr-sqlite/types";

const _load = async ({ params: { date }, parent, depends }: Parameters<PageLoad>[0]) => {
	depends("history:notes");
	const { dbCtx } = await parent();

	if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
		// Or handle error appropriately for print view
		redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
	}

	const dateValue = fromDate(new Date(date), getLocalTimeZone());

	if (!dbCtx) {
		return { date, dateValue, notes: [] as PastNoteItem[] };
	}

	const notes = await getPastNotes(dbCtx.db, date);
	return { date, dateValue, notes };
};

export const load: PageLoad = timed(_load);
