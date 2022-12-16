import { writable, type Readable, type Writable } from 'svelte/store';

import type { NoteAppState, PaginationData, VolumeQuantity } from '$lib/types/inventory';
import { contentStoreLookup, bookStore } from '$lib/data/backend_temp';

import { createDisplayNameStore } from './display_name';
import { createDisplayStateStore, createInternalStateStore, createUpdatedAtStore } from './note_state';
import { createDisplayEntriesStore, createEntriesStore, createPaginationDataStore } from './table_content';

export * from './navigation';

interface NoteDisplayStores {
	displayName: Writable<string | undefined>;
	state: Writable<NoteAppState>;
	updatedAt: Readable<Date | undefined>;
	entries: Readable<VolumeQuantity[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}

interface CreateNoteStores {
	(noteType: 'inbound' | 'outbound', noteId: string): NoteDisplayStores;
}

export const createNoteStores: CreateNoteStores = (noteType: 'inbound' | 'outbound', noteId: string) => {
	// Get appropriate content store for the note type
	const contentStore = contentStoreLookup[noteType];

	const internalState = createInternalStateStore(contentStore, noteId);

	const state = createDisplayStateStore(contentStore, noteId, internalState);
	const displayName = createDisplayNameStore(contentStore, noteId, internalState);
	const updatedAt = createUpdatedAtStore(contentStore, noteId);
	const currentPage = writable(0);
	const allEntries = createEntriesStore(contentStore, bookStore, noteId);
	const entries = createDisplayEntriesStore(allEntries, currentPage);
	const paginationData = createPaginationDataStore(allEntries, currentPage);

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
	(id: string): WarehouseDisplayStores;
}

export const createWarehouseStores: CreateWarehouseStores = (id: string) => {
	const contentStore = contentStoreLookup['stock'];

	const displayName = createDisplayNameStore(contentStore, id);
	const currentPage = writable(0);
	const allEntries = createEntriesStore(contentStore, bookStore, id);
	const entries = createDisplayEntriesStore(allEntries, currentPage);
	const paginationData = createPaginationDataStore(allEntries, currentPage);

	return {
		displayName,
		entries,
		currentPage,
		paginationData
	};
};
