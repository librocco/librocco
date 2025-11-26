import { getActiveInboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, depends }: Parameters<PageLoad>[0]) => {
	depends("inbound:list");

	const { dbCtx: dbCtxOrPromise } = await parent();

	if (!dbCtxOrPromise) {
		return { dbCtx: null, notes: [] };
	}

	const dbCtx = await dbCtxOrPromise;

	const notes = await getActiveInboundNotes(dbCtx.db);

	return { dbCtx, notes };
};

export const load: PageLoad = timed(_load);
