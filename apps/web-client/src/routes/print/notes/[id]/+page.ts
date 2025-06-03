import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getNoteById, getNoteCustomItems, getNoteEntries } from "$lib/db/cr-sqlite/note";
import type { NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	depends("note:books"); // Assuming this dependency is still relevant for print

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	// This check might need re-evaluation for a print page.
	// If dbCtx is always available server-side for this path, this might be okay.
	if (!dbCtx) {
		return {
			dbCtx,
			id,
			displayName: "N/A",
			entries: [] as NoteEntriesItem[],
			customItems: [] as NoteCustomItem[]
		};
	}

	const note = await getNoteById(dbCtx.db, id);
	if (!note) {
		// Changed redirect to a more generic path, or consider error page
		redirect(307, appPath(""));
	}

	const entries = await getNoteEntries(dbCtx.db, id);

	const customItems = await getNoteCustomItems(dbCtx.db, id);

	return { dbCtx, ...note, entries, customItems };
};

export const load: PageLoad = timed(_load);
