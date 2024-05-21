import type { Readable, Writable } from "svelte/store";

import type { NoteInterface, WarehouseInterface } from "@librocco/db";
import type { debug } from "@librocco/shared";

import type { DisplayRow, NoteAppState } from "$lib/types/inventory";

import { createDisplayNameStore } from "$lib/stores/inventory/display_name";
import { createDefaultWarehouseStore } from "$lib/stores/inventory/default_warehouse";
import { createDisplayStateStore, createInternalStateStore } from "$lib/stores/inventory/note_state";
import { createDisplayEntriesStore, mapMergeBookData, mapMergeBookDataCsv } from "./table_content";

import { readableFromStream } from "$lib/utils/streams";
import { getDB } from "$lib/db";
import { createWarehouseDiscountStore } from "$lib/stores/inventory/warehouse_discount";
interface NoteDisplayStores {
	displayName: Writable<string | undefined>;
	defaultWarehouse: Writable<string | undefined>;
	state: Writable<NoteAppState>;
	updatedAt: Readable<Date | null>;
	entries: Readable<DisplayRow[]>;
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
	const noteStateCtx = { name: `[NOTE_STATE::${note?._id}]`, debug: false };
	const internalState = createInternalStateStore(noteStateCtx, note);

	const updatedAtCtx = { name: `[NOTE_UPDATED_AT::${note?._id}]`, debug: false };
	const updatedAt = readableFromStream(updatedAtCtx, note?.stream().updatedAt(updatedAtCtx), null);

	const displayNameCtx = { name: `[NOTE_DISPLAY_NAME::${note?._id}]`, debug: false };
	const displayName = createDisplayNameStore(displayNameCtx, note, undefined);

	const state = createDisplayStateStore(noteStateCtx, note, internalState);

	const entriesCtx = { name: `[NOTE_ENTRIES::${note?._id}]`, debug: false };
	const entries = createDisplayEntriesStore(entriesCtx, getDB(), note, mapMergeBookData);

	const defaultWarehouseCtx = { name: `[NOTE_DEFAULT_WAREHOUSE::${note?._id}]`, debug: false };
	const defaultWarehouse = createDefaultWarehouseStore(defaultWarehouseCtx, note, internalState);

	return {
		displayName,
		state,
		updatedAt,
		entries,
		defaultWarehouse
	};
};

interface WarehouseDisplayStores {
	displayName: Writable<string | undefined>;
	warehouseDiscount: Writable<number>;
	// Warehouse stock will display only book items (no custom items)
	entries: Readable<DisplayRow<"book">[]>;
	csvEntries: Readable<Omit<DisplayRow<"book">, "warehouseId">[]>;
}
interface CreateWarehouseStores {
	(ctx: debug.DebugCtx, warehouse?: WarehouseInterface): WarehouseDisplayStores;
}

/**
 * Creates all the stores needed to display a warehouse view.
 * @param warehouse WarehouseInterface object
 * @returns
 */
export const createWarehouseStores: CreateWarehouseStores = (ctx, warehouse) => {
	const displayNameCtx = { name: `[WAREHOUSE_DISPLAY_NAME::${warehouse?._id}]`, debug: false };
	const displayName = createDisplayNameStore(displayNameCtx, warehouse, null);

	const warehouseDiscountCtx = { name: `[WAREHOUSE_DISCOUNT::${warehouse?._id}]`, debug: false };
	const warehouseDiscount = createWarehouseDiscountStore(warehouseDiscountCtx, warehouse);

	const entries = createDisplayEntriesStore<"book">(ctx, getDB(), warehouse, mapMergeBookData);
	const csvEntries = createDisplayEntriesStore<"book", "csv">(ctx, getDB(), warehouse, mapMergeBookDataCsv);

	return {
		displayName,
		warehouseDiscount,
		entries,
		csvEntries
	};
};
