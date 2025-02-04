import { getActiveInboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, depends }) => {
	depends("inbound:list");

	const { dbCtx } = await parent();

	const notes = dbCtx?.db ? await getActiveInboundNotes(dbCtx?.db) : [];

	return { dbCtx, notes };
};
