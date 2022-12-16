import { derived, type Readable } from 'svelte/store';

import type { NoteStore, WarehouseStore } from '$lib/types/inventory';

import { warehouseStore, inNoteStore, outNoteStore } from '$lib/data/backend_temp';

interface NavListEntry {
	id: string;
	displayName?: string;
}

/** A list of all (non deleted) inbound notes available, used for `/inbound` view note navigation */
export const inNoteList = derived([warehouseStore, inNoteStore], ([warehouses, inNotes]) => {
	const inNotesByWarehouse: Record<string, NavListEntry[]> = { all: [] };
	// Iterate over all warehouses and add non-deleted inNotes for each warehouse to the inNotesByWarehouse object
	Object.keys(warehouses).forEach((warehouse) => {
		inNotesByWarehouse[warehouse] = [];
		warehouses[warehouse].inNotes?.forEach((id) => {
			const { state, displayName } = inNotes[id];
			// If note not deleted, add to in notes list: try and use displayName, otherwise use noteId
			if (state !== 'deleted') inNotesByWarehouse[warehouse].push({ id, displayName });
		});
		// Add the notes to the `all` warehouse
		inNotesByWarehouse.all.push(...inNotesByWarehouse[warehouse]);
	});
	return inNotesByWarehouse;
});
/** A list of all (non deleted) outbound notes available, used for `/outbound` view note navigation */
export const outNoteList = derived<Readable<NoteStore>, NavListEntry[]>(outNoteStore, (outNotes) =>
	// If note not deleted, add to out notes list: try and use displayName, otherwise use noteId
	Object.entries(outNotes)
		.filter(([, { state }]) => state !== 'deleted')
		.map(([id, { displayName }]) => ({
			id,
			displayName
		}))
);
/** A list of all the warehouses available, used for `/stock` view warehouse navigation */
export const warehouseList = derived<Readable<WarehouseStore>, NavListEntry[]>(warehouseStore, (warehouses) =>
	Object.entries(warehouses).map(([id, { displayName }]) => ({
		id,
		displayName
	}))
);
