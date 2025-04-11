import { getActiveInboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, depends }: Parameters<PageLoad>[0]) => {
	depends("inbound:list");

	const { dbCtx } = await parent();

	const notes = dbCtx?.db ? await getActiveInboundNotes(dbCtx?.db) : [];

	return { dbCtx, notes };
};

export const load: PageLoad = timed(_load);
