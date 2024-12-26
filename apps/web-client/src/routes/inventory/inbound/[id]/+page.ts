import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getNoteById, getNoteEntries } from "$lib/db/cr-sqlite/note";

import { appPath } from "$lib/paths";

export const load: PageLoad = async ({ parent, params, depends }) => {
	const id = Number(params.id);

	depends("note:data");
	depends("note:books");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { dbCtx, id, displayName: "N/A", entries: [] };
	}

	const note = await getNoteById(dbCtx.db, id);
	if (!note) {
		throw redirect(307, appPath("inbound"));
	}

	const entries = await getNoteEntries(dbCtx.db, id);

	return { dbCtx, ...note, entries };
};
