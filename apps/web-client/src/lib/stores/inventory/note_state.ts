import { get, writable, type Writable } from 'svelte/store';

import { noteStateLookup, type NoteTempState } from '$lib/enums/inventory';
import { NoteState } from '$lib/enums/db';

import type { NoteInterface } from '$lib/types/db';

/** A union type for note states used in the client app */
type NoteAppState = NoteState | NoteTempState | undefined;

interface CreateInternalStateStore {
	(note: NoteInterface): Writable<NoteAppState>;
}
/**
 * Creates a note state store for internal usage:
 * - the store listens to updates to the note in the db and streams the value for the state to the UI
 * - the store allows for explicit updates (being a writable store) so that we can set temporary states until the update is confirmed by the db
 * @param note Note interface for db communication
 */
export const createInternalStateStore: CreateInternalStateStore = (note) => {
	const state = writable<NoteAppState>();

	return {
		...state,
		subscribe: (...params: Parameters<typeof state.subscribe>) => {
			// Create subscription to the stream, updating the internal store
			// with each stream update.
			const streamSub = note.stream().state.subscribe((content) => {
				state.set(content);
			});
			// Pass the params to internal store subscription
			const unsubscribe = state.subscribe(...params);

			// return an unsubscribe function closing both subscriptions
			return () => {
				streamSub.unsubscribe();
				return unsubscribe();
			};
		}
	};
};

interface CreateDisplayStateStore {
	(note: NoteInterface, internalStateStore: Writable<NoteAppState>): Writable<NoteAppState>;
}
/**
 * Creates a note state store for display purposes:
 * - the store us used to bind to the value of note state element in the UI
 * - it streams the current value of the internal state store
 *   (either a definitive state of the note in the db, or temporary state, while the note in the database is being updated)
 * - it handles updates, comming from the UI, by updating the internal state store and the note in the db accordingly
 * @param note Note interface for db communication
 * @param internalStateStore a store in charge of internal state (this is used to set the temporary state while the note in the db is being updated)
 */
export const createDisplayStateStore: CreateDisplayStateStore = (note, internalStateStore) => {
	const set = (state: NoteState) => {
		// For committed or deleted state, we're setting the temporary state and updating the note in the db.
		//
		// Other updates are no-op as we don't allow explicit setting of temporary states
		// and draft state is the only state from which this function can be called, so updating the 'draft' state to 'draft' state is no-op.
		switch (state) {
			case NoteState.Committed:
				internalStateStore.set(noteStateLookup[state].tempState);
				return note.commit();
			case NoteState.Deleted:
				internalStateStore.set(noteStateLookup[state].tempState);
				return note.delete();
			default:
				return;
		}
	};

	// Update utilises the set function above, will probably not be used, but is here for svelte's Writable interface compatibility.
	const update = (fn: (state: NoteAppState) => NoteState) => {
		set(fn(get(internalStateStore)));
	};

	return {
		subscribe: internalStateStore.subscribe,
		set,
		update
	};
};
