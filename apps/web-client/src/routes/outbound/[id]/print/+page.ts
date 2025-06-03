import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { getNoteById, getNoteEntries, getNoteCustomItems } from "$lib/db/cr-sqlite/note";
import { timed } from "$lib/utils/timer";
import { appPath } from "$lib/paths";
import type { NoteEntriesItem, NoteCustomItem } from "$lib/db/cr-sqlite/types";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);
	depends("note:data"); // Depend on note data
	depends("note:books"); // Depend on note books

	const { dbCtx } = await parent();

	if (!dbCtx) {
		return {
			id,
			note: null,
			entries: [] as NoteEntriesItem[],
			customItems: [] as NoteCustomItem[]
		};
	}

	const note = await getNoteById(dbCtx.db, id);

	if (!note || note.committed) {
		// Or handle error appropriately for print view e.g. show message
		// For now, redirect like the original view
		redirect(307, appPath("outbound"));
	}

	const entries = await getNoteEntries(dbCtx.db, id);
	const customItems = await getNoteCustomItems(dbCtx.db, id);

	return { id, note, entries, customItems };
};

export const load: PageLoad = timed(_load);
