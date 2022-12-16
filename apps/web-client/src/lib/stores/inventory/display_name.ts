import { type Writable, derived, get } from 'svelte/store';

import { NoteTempState } from '$lib/enums/inventory';

import type { NoteAppState, NoteStore, WarehouseStore } from '$lib/types/inventory';

interface CreateDisplayNameStore {
	(
		contentStore: Writable<NoteStore | WarehouseStore>,
		id?: string,
		internalStateStore?: Writable<NoteAppState>
	): Writable<string | undefined>;
}

/**
 * Creates a display name store for a note/warehouse:
 * - the store listens to updates in the content store and streams the value for the displayName to the UI
 * - propagates the update of displayName (from the UI) to the content store
 *
 * @param contentStore a reference to the store containing the note/warehouse content
 * @param id id used to subscribe to the content store and look for updates to the right note/warehouse
 * @param internalStateStore (optional) reference to the internal state store for the note. If provided, the store will be updated with the temp state while the content store updates.
 */
export const createDisplayNameStore: CreateDisplayNameStore = (contentStore, id, internalStateStore) => {
	// Create a derived store that streams the displayName value from the content store
	const displayName = derived(contentStore, ($contentStore) => {
		// No-op if the id is not defined or note/warehouse not found in the content store
		if (!id || !$contentStore[id]) return;

		return $contentStore[id].displayName || id;
	});

	// Set updates the displayName in the content store. If the internalStateStore is provided, it will be updated with 'saving' temp state while the content store updates.
	const set = (displayName: string) => {
		// No-op if the id is not defined (this shouldn't really happen, but as an edge case)
		if (!id) return;

		// If the internalStateStore is provided, set the temp state to 'saving'
		if (internalStateStore) {
			internalStateStore.set(NoteTempState.Saving);
		}

		/** @TEMP */
		// The setTimeout is temporary, to simulate the async nature of the update in production
		setTimeout(() => {
			// Update the displayName in the content store
			contentStore.update((contentStore) => {
				contentStore[id].displayName = displayName;
				return contentStore;
			});
		}, 1000);
	};

	// Update utilises the set function above, will probably not be used, but is here for svelte's Writable interface compatibility.
	const update = (fn: (displayName: string | undefined) => string) => {
		set(fn(get(displayName)));
	};

	return {
		subscribe: displayName.subscribe,
		set,
		update
	};
};
