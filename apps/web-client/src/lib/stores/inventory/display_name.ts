import { type Writable, get } from 'svelte/store';

import type { NoteInterface, WarehouseInterface } from '@librocco/db';

import { NoteTempState } from '$lib/enums/inventory';

import type { NoteAppState } from '$lib/types/inventory';

import { readableFromStream } from '$lib/utils/streams';

interface CreateDisplayNameStore {
	(entity: WarehouseInterface | NoteInterface | undefined, internalStateStore?: Writable<NoteAppState>): Writable<
		string | undefined
	>;
}

/**
 * Creates a display name store for a note/warehouse:
 * - the store listens to updates in the database and streams the value for the displayName to the UI
 * - propagates the update of displayName (from the UI) to the database.
 *
 * @param entity the note/warehouse interface
 * @param internalStateStore (optional) reference to the internal state store for the note. If provided, the store will be updated with the temp state while the content store updates.
 */
export const createDisplayNameStore: CreateDisplayNameStore = (entity, internalStateStore) => {
	const displayName = readableFromStream(entity?.stream().displayName, '');

	// Set method updates the displayName in the database and, if the internal state store is provided, sets the temp state
	// if internal state store is provided (and set to temp state by this action), it will be updated to the non-temp state
	// when the db update is confirmed (but this happens outside of this store)
	const set = (displayName: string) => {
		internalStateStore?.set(NoteTempState.Saving);
		entity?.setName(displayName);
	};

	// Update method updates the store using the set method, only providing the current value of the store to the update function
	// This will probably not be used, but is here for svelte store interface compatibility
	const update = (fn: (displayName: string | undefined) => string) => {
		set(fn(get(displayName)));
	};

	return { subscribe: displayName.subscribe, set, update };
};
