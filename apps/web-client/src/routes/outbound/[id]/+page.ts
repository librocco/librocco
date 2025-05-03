import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { Warehouse, NoteCustomItem, NoteEntriesItem } from "$lib/db/types";

import { getNoteById, getNoteCustomItems, getNoteEntries } from "$lib/db/note";
import { getAllWarehouses } from "$lib/db/warehouse";
import { getStock } from "$lib/db/stock";
import { getPublisherList } from "$lib/db/books";

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
	const customItems = await getNoteCustomItems(dbCtx.db, id);
	const _entries = await getNoteEntries(dbCtx.db, id);
	const publisherList = await getPublisherList(dbCtx.db);

	// If there are no entries, we don't need to go through (potentially expensive) stock query
	if (!_entries.length) {
		return { dbCtx, ...note, warehouses, entries: [], customItems, publisherList };
	}

	// Get availability by ISBN
	const isbns = _entries.map(({ isbn }) => isbn);
	const isbnAvailability = new Map(isbns.map((isbn) => [isbn, new Map<number, { displayName: string; quantity: number }>()]));

	// NOTE: we're skipping this part as it's completely unnecessary if there are no entries,
	// but expecially because getStock below will treat empty 'isbns' as all isbns, leading to extremely expensive
	// query in case of fully populated database
	const stock = await getStock(dbCtx.db, { isbns });
	for (const { isbn, warehouseId, warehouseName, quantity } of stock) {
		isbnAvailability.get(isbn)?.set(warehouseId, { displayName: warehouseName, quantity });
	}
	const entries = _entries.map((e) => ({ ...e, availableWarehouses: isbnAvailability.get(e.isbn) }));

	return { dbCtx, ...note, warehouses, entries, customItems, publisherList };
};

export const load: PageLoad = timed(_load);
