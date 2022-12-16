import { describe, test, expect } from 'vitest';
import { writable, get } from 'svelte/store';

import { NoteState, NoteTempState } from '$lib/enums/inventory';

import type { NoteAppState, NoteStore } from '$lib/types/inventory';

import { createDisplayNameStore } from '../display_name';

import { waitForCondition } from '$lib/__testUtils__/waitForCondition';

import { defaultNote, defaultWarehouse } from '$lib/__testData__/inventory';

describe('createDisplayNameStore', () => {
	test('should stream the display name from the content store for given note/warehouse id', async () => {
		const noteStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const warehouseStore = writable({
			'warehouse-1': defaultWarehouse
		});

		// Test for note
		const noteDisplayName = createDisplayNameStore(noteStore, 'note-1');
		await waitForCondition(
			() => get(noteDisplayName),
			(value) => value === 'Note 1',
			2000
		);
		noteDisplayName.set('Note 1 updated');
		await waitForCondition(
			() => get(noteDisplayName),
			(value) => value === 'Note 1 updated',
			2000
		);

		// Test for warehouse
		const warehouseDisplayName = createDisplayNameStore(warehouseStore, 'warehouse-1');
		await waitForCondition(
			() => get(warehouseDisplayName),
			(value) => value === 'Warehouse 1',
			2000
		);
		warehouseDisplayName.set('Warehouse 1 updated');
		await waitForCondition(
			() => get(warehouseDisplayName),
			(value) => value === 'Warehouse 1 updated',
			2000
		);
	});

	test('should propagate the update to the content store itself', async () => {
		const noteStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const noteDisplayName = createDisplayNameStore(noteStore, 'note-1');

		// Update to the displayName store should get propagated to the content store
		noteDisplayName.set('Note 1 updated');
		await waitForCondition(
			() => get(noteStore)['note-1'].displayName,
			(value) => value === 'Note 1 updated',
			2000
		);
	});

	test("should update the 'internalStateStore' (if provided) with the temp 'saving' state", async () => {
		const noteStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const internalStateStore = writable<NoteAppState>(NoteState.Draft);
		const noteDisplayName = createDisplayNameStore(noteStore, 'note-1', internalStateStore);

		// Update to the displayName store should get propagated to the content store
		noteDisplayName.set('Note 1 updated');
		expect(get(internalStateStore)).toEqual(NoteTempState.Saving);
	});
});
