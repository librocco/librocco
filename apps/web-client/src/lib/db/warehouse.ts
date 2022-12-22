import { derived } from 'svelte/store';

import type { Stores, WarehouseInterface } from '$lib/types/db';
import type { WarehouseStore } from '$lib/types/inventory';

import { newNote } from './note';

export const newWarehouse =
	({ warehouseStore, inNoteStore, outNoteStore }: Stores) =>
	(id = 'all'): WarehouseInterface => {
		// If default warehouse (all) the notes are retrieved from outNoteStore
		// else, the notes are retrieved from inNoteStore
		const noteStore = id === 'all' ? outNoteStore : inNoteStore;

		const update = (warehouse: Partial<WarehouseStore[keyof WarehouseStore]>) =>
			new Promise<void>((resolve) => {
				// No-op if warehouse not found
				if (!id) return;

				/** @TEMP Set timeout is here to simulate the async behaviour in production */
				setTimeout(() => {
					warehouseStore.update((store) => {
						const existinWarehouse = store[id];

						store[id] = { ...existinWarehouse, ...warehouse };

						return store;
					});
				}, 1000);
				resolve();
			});

		const setName = (displayName: string) => update({ displayName });

		const note = newNote(noteStore);

		const stream = () => ({
			displayName: derived(warehouseStore, ($warehouseStore) => {
				const warehouse = $warehouseStore[id];
				return warehouse?.displayName || id;
			}),
			entries: derived(warehouseStore, ($warehouseStore) => {
				const warehouse = $warehouseStore[id];
				return warehouse ? warehouse.entries : [];
			})
		});

		return { setName, note, stream };
	};
