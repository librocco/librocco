import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { Warehouse, NoteCustomItem, NoteEntriesItem } from "$lib/db/cr-sqlite/types";

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
			publisherList: [] as string[],
			isbnAvailability: Map<
				string,
				Map<
					number,
					{
						displayName: string;
						quantity: number;
					}
				>
			>
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
	/**
	Map {
  "978-3-16-148410-0" => Map {
    111 => { displayName: "Warehouse111", quantity: 10 },
    222 => { displayName: "Warehouse222", quantity: 5 }
  },
  "978-1-40-289462-6" => Map {
    111 => { displayName: "Warehouse111", quantity: 8 }
  }
}
	 */
	const isbnAvailability = new Map(isbns.map((isbn) => [isbn, new Map<number, { displayName: string; quantity: number }>()]));

	// NOTE: we're skipping this part as it's completely unnecessary if there are no entries,
	// but expecially because getStock below will treat empty 'isbns' as all isbns, leading to extremely expensive
	// query in case of fully populated database
	const stock = await getStock(dbCtx.db, { isbns });
	for (const { isbn, warehouseId, warehouseName, quantity } of stock) {
		const warehouseExists = warehouses.find((wh) => wh.id === warehouseId);

		if (warehouseExists) {
			isbnAvailability.get(isbn)?.set(warehouseId, { displayName: warehouseName, quantity });
		}
	}
	// for each entry compare quantity with available quantity in warehouse
	// assign min(available quantity, quantity) to entry
	// assign remainder (quantity - available) to forcedEntries\
	const entries: (NoteEntriesItem & { type: "normal" | "forced" } & {
		availableWarehouses: Map<number, { displayName: string; quantity: number }>;
	})[] = [];

	for (const entry of _entries) {
		const available = isbnAvailability.get(entry.isbn)?.get(entry.warehouseId)?.quantity;
		if (available && available === entry.quantity) {
			entries.push({ ...entry, quantity: available, availableWarehouses: isbnAvailability.get(entry.isbn), type: "normal" });
		} else if (!available || (available && available < entry.quantity)) {
			if (available > 0) {
				entries.push({ ...entry, quantity: available, availableWarehouses: isbnAvailability.get(entry.isbn), type: "normal" });
			}
			entries.push({
				...entry,
				quantity: entry.quantity - (available || 0),
				availableWarehouses: isbnAvailability.get(entry.isbn),
				type: "forced"
			});
		} else if (!available || available > entry.quantity) {
			entries.push({ ...entry, availableWarehouses: isbnAvailability.get(entry.isbn), type: "normal" });
		}
	}

	return { dbCtx, ...note, warehouses, entries, customItems, publisherList, isbnAvailability };
};

export const load: PageLoad = timed(_load);
