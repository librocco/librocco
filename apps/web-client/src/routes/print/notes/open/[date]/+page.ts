import { redirect } from "@sveltejs/kit";
import { fromDate, getLocalTimeZone } from "@internationalized/date";

import type { PageLoad } from "./$types";
import { getNoteEntries, getNoteCustomItems } from "$lib/db/cr-sqlite/note";
import type { NoteEntriesItem, NoteCustomItem, PastNoteItem } from "$lib/db/cr-sqlite/types";
import { getPastNotes } from "$lib/db/cr-sqlite/history";

import { appPath } from "$lib/paths";
import { timed } from "$lib/utils/timer";

// Define a new interface for the combined note data
export interface EnrichedPastNoteItem extends PastNoteItem {
	entries: NoteEntriesItem[];
	customItems: NoteCustomItem[];
}

const _load = async ({ params: { date }, parent, depends }: Parameters<PageLoad>[0]) => {
	depends("history:notes"); // Keep existing dependency if relevant

	const { dbCtx } = await parent();

	// Validate the date - if not valid, redirect to a sensible default or error page
	if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
		// Consider redirecting to a specific error page or today's print view
		redirect(307, appPath("history/date", new Date().toISOString().slice(0, 10)));
	}

	// Prepare the date for usage (e.g., if a date picker was to be used on this page)
	const dateValue = fromDate(new Date(date), getLocalTimeZone());

	// If no dbCtx, return empty data structure.
	// This might need adjustment based on whether this page can be fully SSR'd
	// or if dbCtx is expected to be available (e.g. from a layout).
	if (!dbCtx) {
		return { date, dateValue, notes: [] as EnrichedPastNoteItem[] };
	}

	const notesSummaries = await getPastNotes(dbCtx.db, date);

	const enrichedNotes: EnrichedPastNoteItem[] = await Promise.all(
		notesSummaries.map(async (noteSummary) => {
			const entries = await getNoteEntries(dbCtx.db, noteSummary.id);
			const customItems = await getNoteCustomItems(dbCtx.db, noteSummary.id);
			return {
				...noteSummary,
				entries,
				customItems
			};
		})
	);

	return { date, dateValue, notes: enrichedNotes };
};

export const load: PageLoad = timed(_load);
