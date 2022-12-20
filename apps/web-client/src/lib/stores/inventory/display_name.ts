import { type Writable, get } from 'svelte/store';

import { NoteTempState } from '$lib/enums/inventory';

import type { NoteAppState } from '$lib/types/inventory';
import type { NoteInterface, WarehouseInterface } from '$lib/types/db';

interface CreateDisplayNameStore {
	(entity: WarehouseInterface | NoteInterface, internalStateStore?: Writable<NoteAppState>): Writable<
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
	const displayName = entity.stream().displayName;

	const set = (displayName: string) => {
		internalStateStore?.set(NoteTempState.Saving);
		entity.setName(displayName);
	};

	const update = (fn: (displayName: string | undefined) => string) => {
		set(fn(get(displayName)));
	};

	return { subscribe: displayName.subscribe, set, update };
};
