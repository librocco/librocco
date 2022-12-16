import { describe, test, expect } from 'vitest';
import { get, writable } from 'svelte/store';

import { NoteState, NoteTempState } from '$lib/enums/inventory';

import type { NoteStore } from '$lib/types/inventory';

import { createInternalStateStore, createDisplayStateStore } from '../note_state';

import { waitForCondition } from '$lib/__testUtils__/waitForCondition';

import { defaultNote } from '$lib/__testData__/inventory';

describe('createDisplayStateStore', () => {
	test('should stream the internal note state to be displayed', () => {
		const contentStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const internalStateStore = createInternalStateStore(contentStore, 'note-1');
		const displayStateStore = createDisplayStateStore(contentStore, 'note-1', internalStateStore);
		expect(get(displayStateStore)).toBe(NoteState.Draft);
		internalStateStore.set(NoteTempState.Saving);
		expect(get(displayStateStore)).toBe(NoteTempState.Saving);
	});

	test('should set the temp state to the internal store and update the content stor', async () => {
		const contentStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const internalStateStore = createInternalStateStore(contentStore, 'note-1');
		const displayStateStore = createDisplayStateStore(contentStore, 'note-1', internalStateStore);
		displayStateStore.set(NoteState.Committed);
		// The internal state is streamed back to the display state store, so we can test the display store for temp state
		expect(get(displayStateStore)).toBe(NoteTempState.Committing);
		await waitForCondition(
			() => get(displayStateStore),
			(value) => value === NoteState.Committed,
			2000
		);
		expect(get(contentStore)['note-1'].state).toBe(NoteState.Committed);
	});
});
