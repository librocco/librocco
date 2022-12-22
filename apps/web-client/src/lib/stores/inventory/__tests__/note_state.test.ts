import { describe, test, expect } from 'vitest';
import { get, writable } from 'svelte/store';

import { NoteTempState } from '$lib/enums/inventory';
import { NoteState } from '$lib/enums/db';

import type { NoteStore } from '$lib/types/inventory';

import { createInternalStateStore, createDisplayStateStore } from '../note_state';

import { waitForCondition } from '$lib/__testUtils__/waitForCondition';

import { defaultNote } from '$lib/__testData__/inventory';
import { newNote } from '$lib/db/note';

describe('createDisplayStateStore', () => {
	test('should stream the internal note state to be displayed', () => {
		const noteStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const note = newNote(noteStore)('note-1');
		const internalStateStore = createInternalStateStore(note);
		const displayStateStore = createDisplayStateStore(note, internalStateStore);
		expect(get(displayStateStore)).toBe(NoteState.Draft);
		internalStateStore.set(NoteTempState.Saving);
		expect(get(displayStateStore)).toBe(NoteTempState.Saving);
	});

	test('should set the temp state to the internal store and update the content stor', async () => {
		const noteStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const note = newNote(noteStore)('note-1');
		const internalStateStore = createInternalStateStore(note);
		const displayStateStore = createDisplayStateStore(note, internalStateStore);
		displayStateStore.set(NoteState.Committed);
		// The internal state is streamed back to the display state store, so we can test the display store for temp state
		expect(get(displayStateStore)).toBe(NoteTempState.Committing);
		await waitForCondition(
			() => get(displayStateStore),
			(value) => value === NoteState.Committed,
			2000
		);
		expect(get(noteStore)['note-1'].state).toBe(NoteState.Committed);
	});
});
