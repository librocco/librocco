import { derived } from 'svelte/store';

import { NoteState } from '$lib/enums/db';

import type { DbInterface, DbStream, InNoteList, Stores } from '$lib/types/db';

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
		inNoteList: derived([warehouseStore, inNoteStore], ([$warehouseStore, $inNoteStore]) => {
			// Initialise the result with 'all' entries set up
			const res: InNoteList = [{ id: 'all', notes: [] }];

			Object.entries($warehouseStore).forEach(([id, { displayName, inNotes }]) => {
				// Omit warehouse if there are no notes
				if (!inNotes) return;
				const notes = inNotes
					// Filter out non existing or deleted notes
					.filter((noteId) => $inNoteStore[noteId]?.state !== NoteState.Deleted)
					// Add display name for each note
					.map((noteId) => ({ id: noteId, displayName: $inNoteStore[noteId].displayName }));

				// Omit warehouse if there are no filtered notes
				if (!notes.length) return;

				// Add warehouse to result
				res.push({ id, displayName, notes });
				// Add notes to 'all' list
				res[0].notes.push(...notes);
			});
			return res;
		}),
		outNoteList: derived(outNoteStore, ($outNoteStore) =>
			Object.entries($outNoteStore)
				.filter(([, { state }]) => state !== NoteState.Deleted)
				.map(([id, { displayName }]) => ({ id, displayName }))
		)
	});

	return { warehouse, stream };
};
