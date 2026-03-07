import { browser } from "$app/environment";

import { getActiveOutboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

import { getDb } from "$lib/app/db";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
	const { app } = await parent();
	depends("outbound:list");

	if (!browser) {
		return { notes: [] };
	}

	const db = await getDb(app);

	const notes = await getActiveOutboundNotes(db);

	return { notes };
};

export const load: PageLoad = timed(_load);
