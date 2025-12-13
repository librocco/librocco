import { browser } from "$app/environment";
import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getNoteById, getNoteEntries } from "$lib/db/cr-sqlite/note";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

import { app, getDb } from "$lib/app";

const _load = async ({ params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	depends("note:data");
	depends("note:books");

	if (!browser) {
		return { id, displayName: "N/A", entries: [], publisherList: [] as string[] };
	}

	const db = await getDb(app);

	const note = await getNoteById(db, id);

	// If note not found, we shouldn't be here
	// If note committed, we shouldn't be here either (it can be viewed in the note archive)
	// This also triggers redirect to inbound (reactively) upon committing of the note
	if (!note || note.committed) {
		redirect(307, appPath("inbound"));
	}

	const entries = await getNoteEntries(db, id);
	const publisherList = await getPublisherList(db);

	return { ...note, entries, publisherList };
};

export const load: PageLoad = timed(_load);
