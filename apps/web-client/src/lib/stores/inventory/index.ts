import { writable, type Readable, type Writable } from 'svelte/store';

import type { NoteInterface, WarehouseInterface } from '@librocco/db';

import type { DisplayRow, NoteAppState, PaginationData } from '$lib/types/inventory';

import { bookStore } from '$lib/db/data';

import { createDisplayNameStore } from './display_name';
import { createDisplayStateStore, createInternalStateStore } from './note_state';
import { createDisplayEntriesStore, createPaginationDataStore } from './table_content';

import { readableFromStream } from '$lib/utils/streams';

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
	const internalState = createInternalStateStore(note);
	const updatedAt = readableFromStream(note?.stream().updatedAt, null);

	const currentPage = writable(0);

	const displayName = createDisplayNameStore(note, internalState);
	const state = createDisplayStateStore(note, internalState);
	const entries = createDisplayEntriesStore(note, currentPage, bookStore);
	const paginationData = createPaginationDataStore(note, currentPage);

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

	const displayName = createDisplayNameStore(warehouse);
	const entries = createDisplayEntriesStore(warehouse, currentPage, bookStore);
	const paginationData = createPaginationDataStore(warehouse, currentPage);

	return {
		displayName,
		entries,
		currentPage,
		paginationData
	};
};
