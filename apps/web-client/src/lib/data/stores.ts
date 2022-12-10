/**
 * This file contains the middle layer stores serving as a bridge between the backend and the frontend.
 * It keep the frontend code agnostic to the backend implementation and vice versa.
 *
 * We use this so that we're able to change up the frontend code (and frontend interface of these stores)
 * without having to change the backend code and vice versa.
 */

import { derived, type Readable, writable, get } from 'svelte/store';

import { NoteState, noteStateLookup, type NoteTempState } from '$lib/enums/noteStates';

import { page } from '$app/stores';

import {
	bookStore,
	deleteNote,
	commitNote,
	contentStoreLookup,
	warehouseStore,
	outNoteStore,
	type BookEntry,
	type BookStore,
	type NoteStore
} from '$lib/data/backend_temp';

/**
 * The properties of a book + quantity row shown in the note/warehouse table.
 */
type DisplayRow = BookEntry & { quantity: number };

/** A list of all (non deleted) inbound notes available, used for `/inbound` view note navigation */
export const inNoteList = derived(warehouseStore, (ws) =>
	Object.entries(ws).reduce(
		(acc, [wName, { inNotes }]) => ({
			...acc,
			// For each warehouse, we want to also add the in-notes to 'all' warehouse
			all: [...(acc.all ? acc.all : []), ...(inNotes || [])],
			[wName]: inNotes || []
		}),
		{} as Record<string, string[]>
	)
);
/** A list of all (non deleted) outbound notes available, used for `/outbound` view note navigation */
export const outNoteList = derived(outNoteStore, (on) => Object.keys(on));
/** A list of all the warehouses available, used for `/stock` view warehouse navigation */
export const warehouseList = derived(warehouseStore, (warehouses) => Object.keys(warehouses));

/**
 * A factory function used to create a store containing the state of a note.
 * The created store is a writable store where subscribing to the store will return the derived value of `state` for the note,
 * while setting the value of the store will update the `state` of the note in the note content store.
 *
 * @param noteId The id of the note to create a store for.
 * @param type The type (inbound | outbound) of note to create a store for.
 * @returns A store containing the committed state of the note.
 *
 * @example
 * ```svelte
 * <script>
 *   import { page } from '$app/stores';
 *   $: state = createNoteStateStore($page.params.noteId, "inbound");
 * </script>
 *
 * <p>Note State: {$state}</p>
 *
 * <select bind:value={$state}>
 *   <option value="draft">Draft</option>
 *   <option value="committed">Commit</option>
 *   <option value="deleted">Delete</option>
 * </select>
 * ```
 */
export const createNoteStateStore = (noteId: string | undefined, type: 'inbound' | 'outbound') => {
	const contentStore = contentStoreLookup[type];

	// Create a derived store that returns the committed state of the note
	const currentState = writable<NoteState | NoteTempState | undefined>();

	contentStore.subscribe((notes) => {
		// Update the current state store with the new committed state if noteId is defined
		// no-op otherwise
		if (noteId) {
			currentState.set(notes[noteId]?.state);
		}
	});

	// The set function updates the original store (which then updates the derived store)
	const set = (state: NoteState) => {
		// Update the store if noteId is defined, no-op otherwise
		// This shouldn't really happen in production
		if (noteId) {
			// Update the note store with temp state until the content store is updated
			const stateProps = noteStateLookup[state];
			currentState.set(stateProps.tempState);

			// Update the note store with the new committed state
			/** @TODO setTimeout is only here to simulate an asynchronous update, remove later */
			setTimeout(() => {
				// Delete the note if the state is 'deleted'
				if (state === 'deleted') {
					return deleteNote(noteId, type);
				}
				// Commit note if state is 'committed'
				if (state === 'committed') {
					return commitNote(noteId, type);
				}
				// Set the internal state to draft, signaling the note
				// has been saved/updated to the content store.
				if (state === 'draft') {
					currentState.set(NoteState.Draft);
				}
				// Updates to draft won't be happening for now
			}, 1000);
		}
	};

	// The update funciton probably won't be used, but it's here for completeness of the writable store contract
	const update = (cb: (state: NoteState | NoteTempState | undefined) => NoteState) => {
		set(cb(get(currentState)));
	};

	return { subscribe: currentState.subscribe, set, update };
};

/**
 * Creates a store containing the content for table display for a given view.
 * @param contentType
 * @returns
 */
export const createTableContentStore = (contentType: keyof typeof contentStoreLookup) =>
	derived<[Readable<NoteStore>, typeof page, Readable<BookStore>], DisplayRow[]>(
		[contentStoreLookup[contentType], page, bookStore],
		([content, page, bookStore]) => {
			const { id } = page.params as { id?: string };

			// No id will happen quite often: this means we're on root of the view
			// with no single note specified.
			if (!id) {
				return [];
			}

			// If the note/warehouse doesn't exist (or is 'deleted', return undefined)
			if (!content[id] || content[id].state === NoteState.Deleted) {
				return [];
			}

			return content[id].entries.map(({ isbn, quantity }) => ({
				...bookStore[isbn],
				isbn,
				quantity
			}));
		}
	);
