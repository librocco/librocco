import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getNoteById, getNoteCustomItems, getNoteEntries } from "$lib/db/cr-sqlite/note";
import type { NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	depends("note:books");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
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
		redirect(307, appPath("outbound"));
	}

	const entries = await getNoteEntries(dbCtx.db, id);

	const customItems = await getNoteCustomItems(dbCtx.db, id);

	return { dbCtx, ...note, entries, customItems };
};

export const load: PageLoad = timed(_load);
