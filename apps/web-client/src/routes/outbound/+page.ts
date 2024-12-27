import { getAllOutboundNotes } from "$lib/db/cr-sqlite/note";

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, depends }) => {
	depends("outbound:list");

	const { dbCtx } = await parent();

	const notes = dbCtx?.db ? await getAllOutboundNotes(dbCtx?.db) : [];

	return { dbCtx, notes };
};

export const prerender = false;
