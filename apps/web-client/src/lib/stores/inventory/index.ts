import { writable, type Readable, type Writable, derived, get } from "svelte/store";

import type { NoteInterface, WarehouseInterface, SearchIndex } from "@librocco/db";
import type { debug } from "@librocco/shared";

import type { DisplayRow, NoteAppState } from "$lib/types/inventory";

import { createDisplayNameStore } from "./display_name";
import { createDefaultWarehouseStore } from "./default_warehouse";
import { createDisplayStateStore, createInternalStateStore } from "./note_state";
import { createDisplayEntriesStore } from "./table_content";

import { readableFromStream } from "$lib/utils/streams";
import { dbController } from "$lib/db";
import { createWarehouseDiscountStore } from "./warehouse_discount";

interface NoteDisplayStores {
	displayName: Writable<string | undefined>;
	defaultWarehouse: Writable<string | undefined>;
	state: Writable<NoteAppState>;
	updatedAt: Readable<Date | null>;
	entries: Readable<DisplayRow[]>;
	currentPage: Writable<number>;
}
interface CreateNoteStores {
	(note?: NoteInterface): NoteDisplayStores;
}

/**
 * A helper function used to create all the stores needed to display a note view.
 * @note NoteInterface object
 * @returns
 */
export const createNoteStores: CreateNoteStores = (note) => {
	const noteStateCtx = { name: `[NOTE_STATE::${note?.id}]`, debug: false };
	const internalState = createInternalStateStore(noteStateCtx, note);

	const updatedAtCtx = { name: `[NOTE_UPDATED_AT::${note?.id}]`, debug: false };
	const updatedAt = readableFromStream(updatedAtCtx, note?.stream().updatedAt(updatedAtCtx), null);

	const currentPage = writable(0);

	const displayNameCtx = { name: `[NOTE_DISPLAY_NAME::${note?.id}]`, debug: false };
	const displayName = createDisplayNameStore(displayNameCtx, note, undefined);

	const defaultWarehouseCtx = { name: `[NOTE_DEFAULT_WAREHOUSEE::${note?.id}]`, debug: false };
	const defaultWarehouse = createDefaultWarehouseStore(defaultWarehouseCtx, note, undefined);

	const state = createDisplayStateStore(noteStateCtx, note, internalState);

	const entriesCtx = { name: `[NOTE_ENTRIES::${note?.id}]`, debug: false };
	const { entries } = createDisplayEntriesStore(entriesCtx, get(dbController.instance), note, currentPage);

	return {
		displayName,
		state,
		updatedAt,
		entries,
		currentPage,
		defaultWarehouse
	};
};

interface WarehouseDisplayStores {
	displayName: Writable<string | undefined>;
	warehouseDiscount: Writable<number>;
	entries: Readable<DisplayRow[]>;
	currentPageStore: Writable<number>;
	searchStore: Writable<string>;
}
interface CreateWarehouseStores {
	(ctx: debug.DebugCtx, warehouse?: WarehouseInterface, searchIndex?: SearchIndex): WarehouseDisplayStores;
}

/**
 * Creates all the stores needed to display a warehouse view.
 * @param warehouse WarehouseInterface object
 * @returns
 */
export const createWarehouseStores: CreateWarehouseStores = (ctx, warehouse, searchIndex) => {
	const currentPageStore = writable(0);
	const searchStore = writable("");
	// Wrap the search store in a controlled store so that we can search imperatively (e.g. at the click of a button)
	const controlledSearchStore = derived(searchStore, (searchString) =>
		// If search index not provided, this is a noop
		searchIndex
			? {
					searchString,
					isbns: new Set<string>(searchIndex.search(searchString).map(({ isbn }) => isbn))
			  }
			: { searchString: "", isbns: new Set<string>() }
	);

	const displayNameCtx = { name: `[WAREHOUSE_DISPLAY_NAME::${warehouse?.id}]`, debug: false };
	const displayName = createDisplayNameStore(displayNameCtx, warehouse, null);

	const warehouseDiscountCtx = { name: `[WAREHOUSE_DISCOUNT::${warehouse?.id}]`, debug: false };
	const warehouseDiscount = createWarehouseDiscountStore(warehouseDiscountCtx, warehouse);

	const { entries } = createDisplayEntriesStore(ctx, get(dbController.instance), warehouse, currentPageStore, controlledSearchStore);

	return {
		displayName,
		warehouseDiscount,
		entries,
		currentPageStore,
		searchStore
	};
};
