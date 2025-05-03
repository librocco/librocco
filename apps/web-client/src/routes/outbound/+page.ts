import { getActiveOutboundNotes } from "$lib/db/note";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, depends }: Parameters<PageLoad>[0]) => {
	depends("outbound:list");

	const { dbCtx } = await parent();

	const notes = dbCtx?.db ? await getActiveOutboundNotes(dbCtx?.db) : [];

	return { dbCtx, notes };
};

export const load: PageLoad = timed(_load);
