import { derived } from 'svelte/store';

import { NoteState } from '$lib/enums/inventory';

import type { DbInterface, DbStream, Stores } from '$lib/types/db';

import { newWarehouse } from './warehouse';

import { warehouseStore, inNoteStore, outNoteStore } from './data';

const defaultStores = {
	warehouseStore,
	inNoteStore,
	outNoteStore
};

/**
 * Creates an interface for db operations. Accepts optional stores argument to override the default store(s).
 * If not provided, falls back to the default stores. If provided partially, only the provided stores will be overridden.
 * @param overrideStores (optional) partial stores to override
 * @returns
 */
export const db = (overrideStores: Partial<Stores> = {}): DbInterface => {
	const stores = { ...defaultStores, ...overrideStores };

	const { warehouseStore, inNoteStore } = stores;

	const warehouse = (id = 'all') => newWarehouse(stores)(id);

	const stream = (): DbStream => ({
		warehouseList: derived(warehouseStore, ($warehouseStore) =>
			Object.entries($warehouseStore).map(([id, { displayName }]) => ({ id, displayName }))
		),
		inNoteList: derived([warehouseStore, inNoteStore], ([$warehouseStore, $inNoteStore]) =>
			Object.entries($warehouseStore).map(([id, { displayName, inNotes }]) => ({
				id,
				displayName,
				// Get in note keys from warehouse and construct NavListEntry for each
				notes: !inNotes
					? []
					: inNotes
							// Filter out non existing or deleted notes
							.filter((noteId) => $inNoteStore[noteId]?.state !== NoteState.Deleted)
							// Get NavListEntry for each note
							.map((noteId) => ({ id: noteId, displayName: $inNoteStore[noteId].displayName }))
			}))
		),
		outNoteList: derived(inNoteStore, ($inNoteStore) =>
			Object.entries($inNoteStore)
				.filter(([, { state }]) => state !== NoteState.Deleted)
				.map(([id, { displayName }]) => ({ id, displayName }))
		)
	});

	return { warehouse, stream };
};
