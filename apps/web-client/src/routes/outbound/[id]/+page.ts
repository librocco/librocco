import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { Warehouse, DB, NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";

import { getNoteById, getNoteCustomItems, getNoteEntries } from "$lib/db/cr-sqlite/note";
import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";
import { getStock } from "$lib/db/cr-sqlite/stock";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
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
			customItems: [] as NoteCustomItem[],
			publisherList: [] as string[]
		};
	}

	const note = await getNoteById(dbCtx.db, id);
	// If note not found, we shouldn't be here
	// If note committed, we shouldn't be here either (it can be viewed in the note archive)
	// This also triggers redirect to inbound (reactively) upon committing of the note
	if (!note || note.committed) {
		redirect(307, appPath("outbound"));
	}

	const warehouses = await getAllWarehouses(dbCtx.db, { skipTotals: true });
	const _entries = await getNoteEntries(dbCtx.db, id);
	const entriesAvailability = await getAvailabilityByISBN(
		dbCtx.db,
		_entries.map(({ isbn }) => isbn)
	);
	const entries = _entries.map((e, i) => ({ ...e, availableWarehouses: entriesAvailability[i] }));
	const customItems = await getNoteCustomItems(dbCtx.db, id);

	const publisherList = await getPublisherList(dbCtx.db);

	return { dbCtx, ...note, warehouses, entries, customItems, publisherList };
};

// TODO: replace the type
const getAvailabilityByISBN = async (db: DB, isbns: string[]): Promise<Map<number, { displayName: string; quantity: number }>[]> => {
	const resMap = new Map(isbns.map((isbn) => [isbn, new Map<number, { displayName: string; quantity: number }>()]));

	const stock = await getStock(db, { isbns });
	for (const { isbn, warehouseId, warehouseName, quantity } of stock) {
		resMap.get(isbn)?.set(warehouseId, { displayName: warehouseName, quantity });
	}

	return [...resMap.values()];
};

export const load: PageLoad = timed(_load);
