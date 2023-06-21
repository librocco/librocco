import { writable, type Readable, type Writable } from "svelte/store";

import { logger, unwrap } from "@librocco/rxjs-logger";
import type { NoteInterface, WarehouseInterface } from "@librocco/db";

import type { DisplayRow, NoteAppState, PaginationData } from "$lib/types/inventory";

import { createDisplayNameStore } from "./display_name";
import { createDisplayStateStore, createInternalStateStore } from "./note_state";
import { createDisplayEntriesStore } from "./table_content";

import { readableFromStream } from "$lib/utils/streams";
import { getDB } from "$lib/db";

interface NoteDisplayStores {
	displayName: Writable<string | undefined>;
	state: Writable<NoteAppState>;
	updatedAt: Readable<Date | null>;
	entries: Readable<DisplayRow[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}
interface CreateNoteStores {
	(note?: NoteInterface): NoteDisplayStores;
}

/**
 * A helper function used to create all the stores needed to display a note view.
 * @note NoteInterface object
 * @returns
 */
export const createNoteStores: CreateNoteStores = (note) => {
	const ctx = { name: note ? `Note(${note._id})` : "Note(unkonwn)" };

	const internalState = createInternalStateStore(ctx, note);

	const updatedAt = readableFromStream(
		{ ...ctx, debug: false },
		note
			?.stream()
			.updatedAt(ctx)
			.pipe(logger.fork(`${ctx.name}::updated_at`), unwrap()),
		null
	);

	const currentPage = writable(0);

	const displayName = createDisplayNameStore({ ...ctx, debug: false }, note, undefined);

	const state = createDisplayStateStore({ ...ctx, debug: false }, note, internalState);

	const { entries, paginationData } = createDisplayEntriesStore({ ...ctx, debug: false }, getDB(), note, currentPage);

	return {
		displayName,
		state,
		updatedAt,
		entries,
		currentPage,
		paginationData
	};
};

interface WarehouseDisplayStores {
	displayName: Writable<string | undefined>;
	entries: Readable<DisplayRow[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}
interface CreateWarehouseStores {
	(warehouse?: WarehouseInterface): WarehouseDisplayStores;
}

/**
 * Creates all the stores needed to display a warehouse view.
 * @param warehouse WarehouseInterface object
 * @returns
 */
export const createWarehouseStores: CreateWarehouseStores = (warehouse) => {
	const ctx = {
		name: warehouse ? `Warehouse(${warehouse._id})` : "Warehouse(unknown)"
	};

	const currentPage = writable(0);

	const displayName = createDisplayNameStore(ctx, warehouse, null);

	const { entries, paginationData } = createDisplayEntriesStore(ctx, getDB(), warehouse, currentPage);

	return {
		displayName,
		entries,
		currentPage,
		paginationData
	};
};
