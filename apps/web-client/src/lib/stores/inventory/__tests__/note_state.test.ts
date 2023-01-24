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

		// The display state store subscribes to the internal state store and the note store (in db). When the first subscriber is subscribed to the
		// display state store, the subscription to note state is opened. When the last subscriber unsubscribes from the display state store, the
		// subscription to the note store is closed. Then, when the next subscriber is subscribed to the display state store, the subscription to the
		// note store is reopened. This causes any temporary state in the internal store to get reset to the non-temp state. That is exactly what happens
		// when we use 'get(displayStateStore)' to make an assertion as it subscribes and unsubscribes immediately, automatically reseting the internal store
		// and preventing us from testing temp states.
		//
		// This, opening up a dummy subscription for the duration of the test, prevents resubscription and reseting of the internal store and allows us to
		// make assertions against temp states.
		const cleanupSubscription = displayStateStore.subscribe(() => null);

		expect(get(displayStateStore)).toBe(NoteState.Draft);
		internalStateStore.set(NoteTempState.Saving);
		expect(get(displayStateStore)).toBe(NoteTempState.Saving);

		// Close the dummy subscription after assertions
		cleanupSubscription();
	});

	test('should set the temp state to the internal store and update the content store', async () => {
		const noteStore = writable<NoteStore>({
			'note-1': defaultNote
		});
		const note = newNote(noteStore)('note-1');
		const internalStateStore = createInternalStateStore(note);
		const displayStateStore = createDisplayStateStore(note, internalStateStore);

		// See dummy subscription in the previous test ^^
		const cleanupSubscription = displayStateStore.subscribe(() => null);

		displayStateStore.set(NoteState.Committed);
		// The internal state is streamed back to the display state store, so we can test the display store for temp state
		expect(get(displayStateStore)).toBe(NoteTempState.Committing);
		await waitForCondition(
			() => get(displayStateStore),
			(value) => value === NoteState.Committed,
			2000
		);
		expect(get(noteStore)['note-1'].state).toBe(NoteState.Committed);

		// Close the dummy subscription after assertions
		cleanupSubscription();
	});
});
