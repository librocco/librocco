import { getActiveOutboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load: PageLoad = async ({ parent, depends }) => {
	depends("outbound:list");

	const { dbCtx } = await parent();

	const notes = dbCtx?.db ? await getActiveOutboundNotes(dbCtx?.db) : [];

	return { dbCtx, notes };
};

export const load = timed(_load as any) as PageLoad;
