import { get, writable, type Writable } from 'svelte/store';

import type { NoteInterface } from '@librocco/db';
import { debug } from '@librocco/shared';

import { noteStateLookup, type NoteTempState } from '$lib/enums/inventory';
import { NoteState } from '$lib/enums/db';

import type { Subscription } from 'rxjs';

/** A union type for note states used in the client app */
type NoteAppState = NoteState | NoteTempState | undefined;

interface CreateInternalStateStore {
	(note: NoteInterface | undefined, ctx: debug.DebugCtx): Writable<NoteAppState>;
}
/**
 * Creates a note state store for internal usage:
 * - the store listens to updates to the note in the db and streams the value for the state to the UI
 * - the store allows for explicit updates (being a writable store) so that we can set temporary states until the update is confirmed by the db
 * @param note Note interface for db communication
 */
export const createInternalStateStore: CreateInternalStateStore = (note, ctx) => {
	const state = writable<NoteAppState>();

	let noteSubscription: Subscription | undefined = undefined;

	// Open note subscription opens a subscription to the note state which updates the internal store on change
	const openNoteSubscription = () => {
		debug.log(ctx, 'internal_state_store:opening_note_subscription')({});
		noteSubscription = note?.stream(ctx).state.subscribe((content) => {
			debug.log(ctx, 'internal_state_store:update_from_db')(content);
			state.set(content);
		});
	};

	// Close note subscription closes the subscription to the note state
	const closeNoteSubscription = () => {
		debug.log(ctx, 'internal_state_store:closing_note_subscription')({});
		noteSubscription?.unsubscribe();
	};

	// Count the number of subscribers to the store
	let subscribers = 0;

	// Remove subscriber decrements the number of subscribers and, if the number of subscribers is 0, closes the note subscription
	const removeSubscriber = () => {
		subscribers--;
		if (subscribers === 0) {
			closeNoteSubscription();
		}
	};

	// Subscribe method increments the number of subscribers, if this is the first subscriber, it opens the note subscription
	// and streams the internal 'state' store
	const subscribe = (...[notify, invalidate]: Parameters<typeof state.subscribe>) => {
		subscribers++;
		if (subscribers === 1) {
			openNoteSubscription();
		}

		const unsubInternal = state.subscribe((value) => {
			// Log for debugging
			debug.log(ctx, 'internal_state_store:updated')(value);
			// Notify the actual subscriber with appropriate value
			notify(value);
		}, invalidate);

		// The returned 'unsubscribe' function removes a subscriber and unsubscribes from the internal store
		return () => {
			removeSubscriber();
			return unsubInternal();
		};
	};

	return {
		...state,
		subscribe
	};
};

interface CreateDisplayStateStore {
	(
		note: NoteInterface | undefined,
		internalStateStore: Writable<NoteAppState>,
		ctx: debug.DebugCtx
	): Writable<NoteAppState>;
}
/**
 * Creates a note state store for display purposes:
 * - the store us used to bind to the value of note state element in the UI
 * - it streams the current value of the internal state store
 *   (either a definitive state of the note in the db, or temporary state, while the note in the database is being updated)
 * - it handles updates, comming from the UI, by updating the internal state store and the note in the db accordingly
 * @param note Note interface for db communication
 * @param internalStateStore a store in charge of internal state (this is used to set the temporary state while the note in the db is being updated)
 */
export const createDisplayStateStore: CreateDisplayStateStore = (note, internalStateStore, ctx) => {
	const set = (state: NoteState) => {
		const internalState = get(internalStateStore);
		debug.log(ctx, 'display_state_store:set')({ state, internalState });

		// For committed or deleted state, we're setting the temporary state and updating the note in the db.
		//
		// Other updates are no-op as we don't allow explicit setting of temporary states
		// and draft state is the only state from which this function can be called, so updating the 'draft' state to 'draft' state is a no-op.
		switch (state) {
			case NoteState.Committed:
				debug.log(
					ctx,
					'display_state_store:setting_temp_state'
				)({ state, tempState: noteStateLookup[state].tempState });
				internalStateStore.set(noteStateLookup[state].tempState);
				return note?.commit(ctx);
			case NoteState.Deleted:
				debug.log(
					ctx,
					'display_state_store:setting_temp_state'
				)({ state, tempState: noteStateLookup[state].tempState });
				internalStateStore.set(noteStateLookup[state].tempState);
				return note?.delete(ctx);
			default:
				return;
		}
	};

	// Update utilises the set function above, will probably not be used, but is here for svelte's Writable interface compatibility.
	const update = (fn: (state: NoteAppState) => NoteState) => {
		set(fn(get(internalStateStore)));
	};

	return {
		subscribe: internalStateStore.subscribe,
		set,
		update
	};
};
