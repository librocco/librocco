import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getNoteById, getNoteEntries } from "$lib/db/cr-sqlite/note";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	depends("note:data");
	depends("note:books");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { dbCtx, id, displayName: "N/A", entries: [], publisherList: [] as string[] };
	}

	const note = await getNoteById(dbCtx.db, id);

	// If note not found, we shouldn't be here
	// If note committed, we shouldn't be here either (it can be viewed in the note archive)
	// This also triggers redirect to inbound (reactively) upon committing of the note
	if (!note || note.committed) {
		redirect(307, appPath("inbound"));
	}

	const entries = await getNoteEntries(dbCtx.db, id);
	const publisherList = await getPublisherList(dbCtx.db);

	return { dbCtx, ...note, entries, publisherList };
};

export const load: PageLoad = timed(_load);
