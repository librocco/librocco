import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { getNoteById, getNoteEntries } from "$lib/db/cr-sqlite/note";
import { timed } from "$lib/utils/timer";
import { appPath } from "$lib/paths";
import type { NoteEntriesItem } from "$lib/db/cr-sqlite/types";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);
	depends("note:data");
	depends("note:books");

	const { dbCtx } = await parent();

	if (!dbCtx) {
		return { id, note: null, entries: [] as NoteEntriesItem[] };
	}

	const note = await getNoteById(dbCtx.db, id);

	if (!note || note.committed) {
		redirect(307, appPath("inbound")); // Or handle error for print
	}

	const entries = await getNoteEntries(dbCtx.db, id);

	return { id, note, entries };
};

export const load: PageLoad = timed(_load);
