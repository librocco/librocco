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

import { readable, writable } from 'svelte/store';

import { NoteState } from '$lib/enums/inventory';

import type { BookStore, WarehouseStore, NoteStore } from '$lib/types/inventory';

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

/** A lookup table for the content stores, used to get the correct content for a given view (stock/inbound/outbound). */
export const contentStoreLookup = {
	stock: warehouseStore,
	inbound: inNoteStore,
	outbound: outNoteStore
};
// #endregion main_stores

// #region note_state_actions
/**
 * Delete the note from the store. In current implementation the note `state` is set to `deleted`.
 * We might want to change that in the future, for example, completely delete the note, or update the logic
 * to keep the note as, sort of, an archive and periodically clean up the archive of deleted notes.
 *
 * If the note is `deleted` it is omitted from the navigation list and will not be shown in the UI.
 * @param noteId
 * @param type note type: `inbound` | `outbound`
 */
export const deleteNote = (noteId: string, type: 'inbound' | 'outbound') => {
	// Update the note state as deleted
	const contentStore = contentStoreLookup[type];
	contentStore.update((notes) => {
		notes[noteId].state = NoteState.Deleted;
		return notes;
	});
};

/**
 * Sets the note state to `committed`. After that point the note is no longer editable.
 * @param noteId
 * @param type note type: `inbound` | `outbound`
 */
export const commitNote = (noteId: string, type: 'inbound' | 'outbound') => {
	// Update the note state as committed
	const contentStore = contentStoreLookup[type];
	contentStore.update((notes) => {
		notes[noteId].state = NoteState.Committed;
		return notes;
	});
};
// #region note_state_actions
