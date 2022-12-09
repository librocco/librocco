import { readable, derived, type Readable, writable, get } from 'svelte/store';
import { page } from '$app/stores';

import allBooks from './books';
import allWarehouse from './warehouses';
import allInbound from './notes/inbound';
import allOutbound from './notes/outbound';
import { noteStateLookup, type NoteState, type NoteTempState } from '$lib/enums/noteStates';

interface BookEntry {
	isbn: string;
	title: string;
	authors?: string[];
	publisher?: string;
	year?: string;
	price?: number;
}

interface VolumeQuantity {
	isbn: string;
	quantity: number;
}

type DisplayRow = BookEntry & { quantity: number };

export interface BookStore {
	[isbn: string]: BookEntry;
}
const bookStore = readable<BookStore>(allBooks);

interface WarehouseStore {
	[warehouse: string]: {
		entries: VolumeQuantity[];
		inNotes?: string[];
	};
}
const warehouseStore = readable<WarehouseStore>(allWarehouse);

interface NoteStore {
	[noteId: string]: {
		entries: VolumeQuantity[];
		state?: NoteState;
	};
}
const inNoteStore = writable<NoteStore>(allInbound);
const outNoteStore = writable<NoteStore>(allOutbound);

export const warehouses = derived(warehouseStore, (ws) => Object.keys(ws));
export const inNotes = derived(warehouseStore, (ws) =>
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
export const outNotes = derived(outNoteStore, (on) => Object.keys(on));

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
				contentStore.update((notes) => ({
					...notes,
					[noteId]: {
						...notes[noteId],
						state
					}
				}));
			}, 1000);
		}
	};

	// The update funciton probably won't be used, but it's here for completeness of the writable store contract
	const update = (cb: (state: NoteState | NoteTempState | undefined) => NoteState) => {
		set(cb(get(currentState)));
	};

	return { subscribe: currentState.subscribe, set, update };
};

const contentStoreLookup = {
	stock: warehouseStore,
	inbound: inNoteStore,
	outbound: outNoteStore
};

export const createTableContentStore = (contentType: keyof typeof contentStoreLookup) =>
	derived<
		[Readable<NoteStore>, typeof page, Readable<BookStore>],
		{ entries: DisplayRow[]; state?: NoteState | NoteTempState | undefined }
	>([contentStoreLookup[contentType], page, bookStore], ([content, page, bookStore]) => {
		const { id } = page.params as { id?: string };

		// No id will happen quite often: this means we're on root of the view
		// with no single note specified.
		if (!id) {
			return { entries: [] as DisplayRow[], committed: false };
		}

		// TODO: we might want to throw 404 here...
		if (!content[id]) {
			return { entries: [] as DisplayRow[], committed: false };
		}

		return {
			entries: content[id].entries.map(({ isbn, quantity }) => ({
				...bookStore[isbn],
				isbn,
				quantity
			}))
		};
	});
