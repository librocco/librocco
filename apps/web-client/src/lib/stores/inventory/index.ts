import { writable, type Readable, type Writable } from "svelte/store";

import type { NoteInterface, WarehouseInterface } from "@librocco/db";

import type { DisplayRow, NoteAppState, PaginationData } from "$lib/types/inventory";

import { createDisplayNameStore } from "./display_name";
import { createDisplayStateStore, createInternalStateStore } from "./note_state";
import { createDisplayEntriesStore } from "./table_content";

import { readableFromStream } from "$lib/utils/streams";
import { getDB } from "$lib/db";
import { createWarehouseDiscountStore } from "./warehouse_discount";

interface NoteDisplayStores {
	displayName: Writable<string | undefined>;
	state: Writable<NoteAppState>;
	updatedAt: Readable<Date | null>;
	entries: Readable<DisplayRow[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
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

	const currentPage = writable(0);

	const displayNameCtx = { name: `[NOTE_DISPLAY_NAME::${note?._id}]`, debug: false };
	const displayName = createDisplayNameStore(displayNameCtx, note, undefined);

	const state = createDisplayStateStore(noteStateCtx, note, internalState);

	const entriesCtx = { name: `[NOTE_ENTRIES::${note?._id}]`, debug: false };
	const { entries, paginationData } = createDisplayEntriesStore(entriesCtx, getDB(), note, currentPage);

	return {
		displayName,
		state,
		updatedAt,
		entries,
		currentPage,
		paginationData
	};
};

interface WarehouseDisplayStores {
	displayName: Writable<string | undefined>;
	warehouseDiscount: Writable<number>;
	entries: Readable<DisplayRow[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}
interface CreateWarehouseStores {
	(warehouse?: WarehouseInterface): WarehouseDisplayStores;
}

/**
 * Creates all the stores needed to display a warehouse view.
 * @param warehouse WarehouseInterface object
 * @returns
 */
export const createWarehouseStores: CreateWarehouseStores = (warehouse) => {
	const currentPage = writable(0);

	const displayNameCtx = { name: `[WAREHOUSE_DISPLAY_NAME::${warehouse?._id}]`, debug: false };
	const displayName = createDisplayNameStore(displayNameCtx, warehouse, null);

	const warehouseDiscountCtx = { name: `[WAREHOUSE_DISCOUNT::${warehouse?._id}]`, debug: false };
	const warehouseDiscount = createWarehouseDiscountStore(warehouseDiscountCtx, warehouse);

	const entriesCtx = { name: `[WAREHOUSE_ENTRIES::${warehouse?._id}]`, debug: false };
	const { entries, paginationData } = createDisplayEntriesStore(entriesCtx, getDB(), warehouse, currentPage);

	return {
		displayName,
		warehouseDiscount,
		entries,
		currentPage,
		paginationData
	};
};
