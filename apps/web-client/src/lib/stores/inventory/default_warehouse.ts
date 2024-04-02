import { type Writable, get } from "svelte/store";

import type { NoteInterface } from "@librocco/db";
import { NoteState, NoteTempState, debug } from "@librocco/shared";

import type { NoteAppState } from "$lib/types/inventory";

import { readableFromStream } from "$lib/utils/streams";

interface CreateDefaultWarehouseStore {
	(ctx: debug.DebugCtx, note: NoteInterface | undefined, internalStateStore: Writable<NoteAppState> | null): Writable<string | undefined>;
}

/**
 * Creates a default warehouse store for a note:
 * - the store listens to updates in the database and streams the value for the defaultWarehouse to the UI
 * - propagates the update of defaultWarehouse (from the UI) to the database.
 *
 * @param ctx Debug context
 * @param note the note interface
 * @param internalStateStore (optional) reference to the internal state store for the note. If provided, the store will be updated with the temp state while the content store updates.
 */
export const createDefaultWarehouseStore: CreateDefaultWarehouseStore = (ctx, note, internalStateStore) => {
	const defaultWarehouseInternal = readableFromStream(ctx, note?.stream().defaultWarehouseId(ctx), "");

	// Set method updates the defaultWarehouse in the database and, if the internal state store is provided, sets the temp state
	// if internal state store is provided (and set to temp state by this action), it will be updated to the non-temp state
	// when the db update is confirmed (but this happens outside of this store)
	const set = (defaultWarehouseId: string) => {
		const currentdefaultWarehouseId = get(defaultWarehouseInternal);
		const internalState = get(internalStateStore);
		debug.log(ctx, "default_warehouse_store:set")({ defaultWarehouseId, currentdefaultWarehouseId, internalState });

		// We're not allowing empty default warehouses nor updating the
		// name if the name passed is the same as the current name
		// nore inbound notes to have a default warehouse.
		if (
			!defaultWarehouseId ||
			defaultWarehouseId === currentdefaultWarehouseId ||
			note.noteType !== "outbound" ||
			internalState === NoteState.Committed
		) {
			debug.log(ctx, "default_warehouse_store:set:noop")({ defaultWarehouseId, currentdefaultWarehouseId, internalState });
			return;
		}

		internalStateStore?.set(NoteTempState.Saving);
		note?.setDefaultWarehouse(ctx, defaultWarehouseId);
	};

	// Update method updates the store using the set method, only providing the current value of the store to the update function
	// This will probably not be used, but is here for svelte store interface compatibility
	const update = (fn: (defaultWarehouseId: string | undefined) => string) => {
		debug.log(ctx, "default_warehouse_store:update")(defaultWarehouseInternal);
		set(fn(get(defaultWarehouseInternal)));
	};

	return { subscribe: defaultWarehouseInternal.subscribe, set, update };
};
