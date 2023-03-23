import { writable, type Readable, type Writable } from "svelte/store";

import type { NoteInterface, WarehouseInterface } from "@librocco/db";

import type { DisplayRow, NoteAppState, PaginationData } from "$lib/types/inventory";

import { createDisplayNameStore } from "./display_name";
import { createDisplayStateStore, createInternalStateStore } from "./note_state";
import { createDisplayEntriesStore, createPaginationDataStore } from "./table_content";

import { readableFromStream } from "$lib/utils/streams";
import { getDB } from "$lib/db";

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
	const noteStateCtx = {
		name: `[NOTE_STATE::${note?._id}]`,
		debug: false
	};
	const internalState = createInternalStateStore(note, noteStateCtx);

	const updatedAtCtx = {
		name: `[NOTE_UPDATED_AT::${note?._id}]`,
		debug: false
	};
	const updatedAt = readableFromStream(note?.stream(updatedAtCtx).updatedAt, null, updatedAtCtx);

	const currentPage = writable(0);

	const displayName = createDisplayNameStore(note, undefined, {
		name: `[NOTE_DISPLAY_NAME::${note?._id}]`,
		debug: false
	});
	const state = createDisplayStateStore(note, internalState, noteStateCtx);
	const entries = createDisplayEntriesStore(getDB(), note, currentPage, {
		name: `[NOTE_ENTRIES::${note?._id}]`,
		debug: false
	});
	const paginationData = createPaginationDataStore(note, currentPage, {
		name: `[NOTE_PAGINATION::${note?._id}]`,
		debug: false
	});

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
	entries: Readable<DisplayRow[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}
interface CreateWarehouseStores {
	(warehouse?: WarehouseInterface): WarehouseDisplayStores;
}

/**
 * Creates all the stores needed to display a warehouse view.
 * @param db db interface
 * @param warehouseId
 * @returns
 */
export const createWarehouseStores: CreateWarehouseStores = (warehouse) => {
	const currentPage = writable(0);

	const displayName = createDisplayNameStore(warehouse, null, {
		name: `[WAREHOUSE_DISPLAY_NAME::${warehouse?._id}]`,
		debug: false
	});
	const entries = createDisplayEntriesStore(getDB(), warehouse, currentPage, {
		name: `[WAREHOUSE_ENTRIES::${warehouse?._id}]`,
		debug: false
	});
	const paginationData = createPaginationDataStore(warehouse, currentPage, {
		name: `[WAREHOUSE_PAGINATION::${warehouse?._id}]`,
		debug: false
	});

	return {
		displayName,
		entries,
		currentPage,
		paginationData
	};
};
