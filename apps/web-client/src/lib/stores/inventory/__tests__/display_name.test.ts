import { describe, test, expect } from 'vitest';
import { writable, get } from 'svelte/store';

import { NoteState, NoteTempState } from '$lib/enums/inventory';

import type { NoteAppState, NoteStore } from '$lib/types/inventory';

import { createDisplayNameStore } from '../display_name';

import { waitForCondition } from '$lib/__testUtils__/waitForCondition';

import { defaultNote, defaultWarehouse } from '$lib/__testData__/inventory';
import { newNote } from '$lib/db/note';
import { newWarehouse } from '$lib/db/warehouse';

describe('createDisplayNameStore', () => {
	test('should stream the display name from the content store for given note/warehouse id', async () => {
		// Test for note
		const inNoteStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const note = newNote(inNoteStore)('note-1');
		const noteDisplayName = createDisplayNameStore(note);
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
		const warehouseStore = writable({
			'warehouse-1': defaultWarehouse
		});
		const warehouse = newWarehouse({ inNoteStore, warehouseStore, outNoteStore: writable() })('warehouse-1');
		const warehouseDisplayName = createDisplayNameStore(warehouse);
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
		const note = newNote(noteStore)('note-1');
		const noteDisplayName = createDisplayNameStore(note);

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
		const note = newNote(noteStore)('note-1');
		const internalStateStore = writable<NoteAppState>(NoteState.Draft);
		const noteDisplayName = createDisplayNameStore(note, internalStateStore);

		// Update to the displayName store should get propagated to the content store
		noteDisplayName.set('Note 1 updated');
		expect(get(internalStateStore)).toEqual(NoteTempState.Saving);
	});
});
