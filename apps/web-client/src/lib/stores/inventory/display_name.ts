import { type Writable, get } from "svelte/store";

import type { NoteInterface, WarehouseInterface } from "@librocco/db";
import { NoteState, NoteTempState, debug } from "@librocco/shared";

import type { NoteAppState } from "$lib/types/inventory";

import { readableFromStream } from "$lib/utils/streams";

interface CreateDisplayNameStore {
	(
		ctx: debug.DebugCtx,
		entity: WarehouseInterface | NoteInterface | undefined,
		internalStateStore: Writable<NoteAppState> | null
	): Writable<string | undefined>;
}

/**
 * Creates a display name store for a note/warehouse:
 * - the store listens to updates in the database and streams the value for the displayName to the UI
 * - propagates the update of displayName (from the UI) to the database.
 *
 * @param ctx Debug context
 * @param entity the note/warehouse interface
 * @param internalStateStore (optional) reference to the internal state store for the note. If provided, the store will be updated with the temp state while the content store updates.
 */
export const createDisplayNameStore: CreateDisplayNameStore = (ctx, entity, internalStateStore) => {
	const displayNameInternal = readableFromStream(ctx, entity?.stream().displayName(ctx), "");

	// Set method updates the displayName in the database and, if the internal state store is provided, sets the temp state
	// if internal state store is provided (and set to temp state by this action), it will be updated to the non-temp state
	// when the db update is confirmed (but this happens outside of this store)
	const set = (displayName: string) => {
		const currentDisplayName = get(displayNameInternal);
		const internalState = get(internalStateStore);
		debug.log(ctx, "display_name_store:set")({ displayName, currentDisplayName, internalState });

		// We're not allowing empty display names nor updating the
		// name if the name passed is the same as the current name.
		if (!displayName || displayName === currentDisplayName || internalState === NoteState.Committed) {
			debug.log(ctx, "display_name_store:set:noop")({ displayName, currentDisplayName, internalState });
			return;
		}

		internalStateStore?.set(NoteTempState.Saving);
		entity?.setName(ctx, displayName);
	};

	// Update method updates the store using the set method, only providing the current value of the store to the update function
	// This will probably not be used, but is here for svelte store interface compatibility
	const update = (fn: (displayName: string | undefined) => string) => {
		debug.log(ctx, "display_name_store:update")(displayNameInternal);
		set(fn(get(displayNameInternal)));
	};

	return { subscribe: displayNameInternal.subscribe, set, update };
};
