import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { Warehouse } from "$lib/db/cr-sqlite/types";

import { getNoteById, getNoteCustomItems, getNoteEntries } from "$lib/db/cr-sqlite/note";
import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";
import type { NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";

import { appPath } from "$lib/paths";

export const load: PageLoad = async ({ parent, params, depends }) => {
	const id = Number(params.id);

	depends("note:data");
	depends("note:books");
	depends("warehouse:list");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return {
			dbCtx,
			id,
			displayName: "N/A",
			warehouses: [] as Warehouse[],
			entries: [] as NoteEntriesItem[],
			customItems: [] as NoteCustomItem[]
		};
	}

	const note = await getNoteById(dbCtx.db, id);
	if (!note) {
		throw redirect(307, appPath("outbound"));
	}

	const warehouses = await getAllWarehouses(dbCtx.db);
	const entries = await getNoteEntries(dbCtx.db, id);
	const customItems = await getNoteCustomItems(dbCtx.db, id);

	return { dbCtx, ...note, warehouses, entries, customItems };
};
