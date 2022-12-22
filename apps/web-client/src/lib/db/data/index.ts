/**
 * **************************************************************
 * *  This file contains the temporary backend implementation.  *
 * **************************************************************
 *
 * 1. (Current) Pass: the stores currently contain the test data commited in the repo as .json files.
 *
 * 2. Pass: the stores will be replaced with pouchdb in browser storage:
 * 3. Pass: the in-browser db will be connected to couchdb:
 * 		- Docker image with data baked in (for testing/dev)
 * 		- Self hosted (configurable through env variables) couchdb (for production)
 */

import { derived, readable, writable } from 'svelte/store';

import type { BookStore, WarehouseStore, NoteStore } from '$lib/types/inventory';
import type { NoteLookupResult } from '$lib/types/db';

import allBooks from './books';
import allWarehouse from './warehouses';
import allInbound from './notes/inbound';
import allOutbound from './notes/outbound';

// #region main_stores
/**
 * The following are the stores with baked in test data.
 * These stores are sort of a placeholder for the db used in production.
 */

/** The store containing all the available books. (This is currently a baked in, test data store) */
export const bookStore = readable<BookStore>(allBooks);

/** All of the warehouses with their quentities and `inNotes` */
export const warehouseStore = writable<WarehouseStore>(allWarehouse);

/** A store containing all inbound notes. (This is currently a baked in, test data store) */
export const inNoteStore = writable<NoteStore>(allInbound);
/** A store containing all outbound notes. (This is currently a baked in, test data store)  */
export const outNoteStore = writable<NoteStore>(allOutbound);

/** A derived store used to look up the note state, type, warehouse and displayName */
export const noteLookup = derived(
	[inNoteStore, outNoteStore, warehouseStore],
	([$inNoteStore, $outNoteStore, $warehouseStore]) => {
		const lookup: Record<string, NoteLookupResult> = {};

		// Add in notes to the lookup
		for (const [warehouse, { inNotes }] of Object.entries($warehouseStore)) {
			if (inNotes) {
				for (const noteId of inNotes) {
					const note = $inNoteStore[noteId];
					if (note) {
						lookup[noteId] = {
							id: noteId,
							state: note.state,
							type: 'inbound',
							warehouse,
							displayName: note.displayName
						};
					}
				}
			}
		}

		// Add out notes to the lookup
		for (const [noteId, { state, displayName }] of Object.entries($outNoteStore)) {
			lookup[noteId] = {
				id: noteId,
				state,
				type: 'outbound',
				warehouse: 'all',
				displayName
			};
		}

		return lookup;
	}
);

/** A lookup table for the content stores, used to get the correct content for a given view (stock/inbound/outbound). */
export const contentStoreLookup = {
	stock: warehouseStore,
	inbound: inNoteStore,
	outbound: outNoteStore
};
// #endregion main_stores
