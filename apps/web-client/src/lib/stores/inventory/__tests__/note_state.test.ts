import { describe, test, expect } from 'vitest';
import { get } from 'svelte/store';
import { firstValueFrom } from 'rxjs';

import { testUtils } from '@librocco/shared';

import { NoteTempState } from '$lib/enums/inventory';
import { NoteState } from '$lib/enums/db';

import { createInternalStateStore, createDisplayStateStore } from '../note_state';

import { newTestDB } from '$lib/__testUtils__/db';

const { waitFor } = testUtils;

describe('createDisplayStateStore', () => {
	test('should stream the internal note state to be displayed', async () => {
		const db = await newTestDB();
		const note = await db.warehouse().note('note-1').create();

		const internalStateStore = createInternalStateStore(note, {});
		const displayStateStore = createDisplayStateStore(note, internalStateStore, {});

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

		// Wait for the store to set up (get initial value from the db)
		await waitFor(() => {
			expect(get(displayStateStore)).toBe(NoteState.Draft);
		});
		internalStateStore.set(NoteTempState.Saving);
		expect(get(displayStateStore)).toBe(NoteTempState.Saving);

		// Close the dummy subscription after assertions
		cleanupSubscription();
	});

	test('should set the temp state to the internal store and update the content store', async () => {
		const db = await newTestDB();
		const note = await db.warehouse().note('note-1').create();

		const internalStateStore = createInternalStateStore(note, {});
		const displayStateStore = createDisplayStateStore(note, internalStateStore, {});

		// See dummy subscription in the previous test ^^
		const cleanupSubscription = displayStateStore.subscribe(() => null);

		displayStateStore.set(NoteState.Committed);
		// The internal state is streamed back to the display state store, so we can test the display store for temp state
		expect(get(displayStateStore)).toBe(NoteTempState.Committing);
		await waitFor(() => {
			expect(get(displayStateStore)).toBe(NoteState.Committed);
		});

		// Check that the note state in db has been updated
		const noteState = await firstValueFrom(note.stream({}).state);
		expect(noteState).toBe(NoteState.Committed);

		// Close the dummy subscription after assertions
		cleanupSubscription();
	});

	test('should short circuit updates if the updated state is the same as the current state', async () => {
		const db = await newTestDB();
		const note = await db.warehouse().note('note-1').create();

		// In production this is the most common case of setting the state to the same value.
		// On init the state picker's bind:value runs an update with the initial state, which is the same as the current state.
		await note.commit({});

		const internalStateStore = createInternalStateStore(note, {});
		const displayStateStore = createDisplayStateStore(note, internalStateStore, {});

		// See dummy subscription in the previous test ^^
		const cleanupSubscription = displayStateStore.subscribe(() => null);

		// Wait for the store to set up (get initial value from the db)
		await waitFor(() => {
			expect(get(displayStateStore)).toBe(NoteState.Committed);
		});

		// Set the state to the same value as the current state.
		// Normally this would trigger setting a temp 'committing' state until the
		// note commit has finished a round trip. However, since the note is already committed
		// not state update would come from the db and we would get stuck in the temp state.
		displayStateStore.set(NoteState.Committed);
		expect(get(displayStateStore)).toBe(NoteState.Committed);

		// Close the dummy subscription after assertions
		cleanupSubscription();
	});

	test("should stream 'undefined' if no note provided", () => {
		// Check for both internal state store as well as display state store
		const internalStateStore = createInternalStateStore(undefined, {});
		const displayStateStore = createDisplayStateStore(undefined, internalStateStore, {});
		expect(get(displayStateStore)).toEqual(undefined);
	});
});
