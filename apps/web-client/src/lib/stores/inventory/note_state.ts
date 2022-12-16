import { derived, get, writable, type Readable, type Writable } from 'svelte/store';

import { NoteState, noteStateLookup, type NoteTempState } from '$lib/enums/inventory';

import type { NoteStore } from '$lib/types/inventory';

/** A union type for note states used in the client app */
type NoteAppState = NoteState | NoteTempState | undefined;

interface CreateInternalStateStore {
	(conetentStore: Readable<NoteStore>, notdId: string | undefined): Writable<NoteAppState>;
}

/**
 * Creates a note state store for internal usage:
 * - the store listens to updates in the content store
 * - the store allows for explicit updates (being a writable store) so that we can set temporary states until the update is confirmed by the content store
 * @param contentStore a reference to the store containing the note content (inNoteStore or outNoteStore)
 * @param noteId id used to subscribe to the content store and look for updates to the right note
 */
export const createInternalStateStore: CreateInternalStateStore = (contentStore, noteId) => {
	const state = writable<NoteAppState>();

	// Update the internal state each time the content store is updated
	contentStore.subscribe((content) => {
		// No-op if the noteId is not defined
		if (!noteId) return;
		state.set(content[noteId]?.state);
	});

	return state;
};

interface CreateDisplayStateStore {
	(
		contentStore: Writable<NoteStore>,
		noteId: string | undefined,
		internalStateStore: Writable<NoteAppState>
	): Writable<NoteAppState>;
}

/**
 * Creates a note state store for display purposes:
 * - the store us used to bind to the value of note state element in the UI
 * - it streams the current value of the internal state store
 *   (either a definitive state of the note in the content store, or temporary state, while the content store is being updated)
 * - it handles updates, comming from the UI, by updating the internal state store and the note in the content store accordingly.
 * @param conetentStore
 * @param internalStateStore
 */
export const createDisplayStateStore: CreateDisplayStateStore = (conetentStore, noteId, internalStateStore) => {
	const set = (state: NoteState) => {
		// No-op if the noteId is not defined (this shouldn't really happen, but as an edge case)
		if (!noteId) return;

		// For committed or deleted state, we're setting the temporary state and updating the content store.
		//
		// Other updates are no-op as we don't allow explicit setting of temporary states
		// and draft state is the only state from which this function can be called, so updating the 'draft' state to 'draft' state is no-op.
		if ([NoteState.Committed, NoteState.Deleted].includes(state)) {
			internalStateStore.set(noteStateLookup[state].tempState);

			/** @TEMP */
			// The setTimeout is temporary, to simulate the async nature of the update in production
			setTimeout(() => {
				// Update the state of the note in the content store
				conetentStore.update((notes) => {
					// No-op if note not found
					if (!notes[noteId]) return notes;

					notes[noteId].state = state;
					return notes;
				});
			}, 1000);
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

export const createUpdatedAtStore = (
	contentStore: Readable<NoteStore>,
	noteId: string | undefined
): Readable<Date | undefined> => {
	const store = derived(contentStore, ($contentStore) => {
		// No-op if the noteId is not defined or no note in store
		if (!noteId || !$contentStore[noteId]) return undefined;

		return new Date($contentStore[noteId].updatedAt);
	});

	return store;
};
