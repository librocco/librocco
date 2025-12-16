import { browser } from "$app/environment";

import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getNoteById, getNoteCustomItems, getNoteEntries } from "$lib/db/cr-sqlite/note";
import type { NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ params, depends, parent }: Parameters<PageLoad>[0]) => {
	await parent();
	const id = Number(params.id);

	depends("note:books");

	if (!browser) {
		return {
			id,
			displayName: "N/A",
			entries: [] as NoteEntriesItem[],
			customItems: [] as NoteCustomItem[]
		};
	}

	const db = await getDb(app);

	const note = await getNoteById(db, id);
	if (!note) {
		redirect(307, appPath("outbound"));
	}

	const entries = await getNoteEntries(db, id);

	const customItems = await getNoteCustomItems(db, id);

	return { ...note, entries, customItems };
};

export const load: PageLoad = timed(_load);
