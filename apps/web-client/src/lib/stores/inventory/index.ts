import { writable, type Readable, type Writable } from 'svelte/store';

import type { DbInterface, VolumeQuantity } from '$lib/types/db';
import type { NoteAppState, PaginationData } from '$lib/types/inventory';

import { bookStore } from '$lib/db/data';

import { createDisplayNameStore } from './display_name';
import { createDisplayStateStore, createInternalStateStore } from './note_state';
import { createDisplayEntriesStore, createPaginationDataStore } from './table_content';
import { readableFromStream } from '$lib/utils/streams';

interface NoteDisplayStores {
	displayName: Writable<string | undefined>;
	state: Writable<NoteAppState>;
	updatedAt: Readable<Date | undefined>;
	entries: Readable<VolumeQuantity[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}
interface CreateNoteStores {
	(db: DbInterface, id: string, warehouseId?: string): NoteDisplayStores;
}

/**
 * A helper function used to create all the stores needed to display a note view.
 * @param db db interface
 * @param noteId
 * @param warehouseId (optional) in notes are organised per warehouse basis, for out notes this should be `undefined`
 * @returns
 */
export const createNoteStores: CreateNoteStores = (db, noteId, warehouseId) => {
	console.log('Note ID: ' + noteId + ' Warehouse ID: ' + warehouseId);
	const note = db.warehouse(warehouseId).note(noteId);

	const internalState = createInternalStateStore(note);
	const updatedAt = readableFromStream(note.stream().updatedAt);

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
	entries: Readable<VolumeQuantity[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}
interface CreateWarehouseStores {
	(db: DbInterface, warehouseId: string): WarehouseDisplayStores;
}

/**
 * Creates all the stores needed to display a warehouse view.
 * @param db db interface
 * @param warehouseId
 * @returns
 */
export const createWarehouseStores: CreateWarehouseStores = (db, warehouseId) => {
	const warehouse = db.warehouse(warehouseId);
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
