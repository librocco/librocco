import { getActiveOutboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, depends }) => {
	depends("outbound:list");

	const { dbCtx } = await parent();

	const notes = dbCtx?.db ? await getActiveOutboundNotes(dbCtx?.db) : [];

	return { dbCtx, notes };
};
