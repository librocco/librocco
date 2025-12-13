import { browser } from "$app/environment";

import { getActiveInboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ depends }: Parameters<PageLoad>[0]) => {
	depends("inbound:list");

	if (!browser) {
		return { notes: [] };
	}

	const db = await getDb(app);

	const notes = await getActiveInboundNotes(db);

	return { notes };
};

export const load: PageLoad = timed(_load);
