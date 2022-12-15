/**
 * This file contains the middle layer stores serving as a bridge between the backend and the frontend.
 * It keep the frontend code agnostic to the backend implementation and vice versa.
 *
 * We use this so that we're able to change up the frontend code (and frontend interface of these stores)
 * without having to change the backend code and vice versa.
 */

import { derived, type Readable, writable, get, type Writable } from 'svelte/store';

import { NoteState, noteStateLookup, type NoteTempState } from '$lib/enums/noteStates';

import {
	bookStore,
	deleteNote,
	commitNote,
	contentStoreLookup,
	warehouseStore,
	inNoteStore,
	outNoteStore,
	type BookEntry,
	type BookStore,
	type NoteStore,
	type WarehouseStore
} from '$lib/data/backend_temp';

/**
 * The properties of a book + quantity row shown in the note/warehouse table.
 */
type DisplayRow = BookEntry & { quantity: number };

interface NoteListEntry {
	id: string;
	displayName?: string;
}

/** A list of all (non deleted) inbound notes available, used for `/inbound` view note navigation */
export const inNoteList = derived([warehouseStore, inNoteStore], ([warehouses, inNotes]) => {
	const inNotesByWarehouse: Record<string, NoteListEntry[]> = { all: [] };
	// Iterate over all warehouses and add non-deleted inNotes for each warehouse to the inNotesByWarehouse object
	Object.keys(warehouses).forEach((warehouse) => {
		inNotesByWarehouse[warehouse] = [];
		warehouses[warehouse].inNotes?.forEach((id) => {
			const { state, displayName } = inNotes[id];
			// If note not deleted, add to in notes list: try and use displayName, otherwise use noteId
			if (state !== 'deleted') inNotesByWarehouse[warehouse].push({ id, displayName });
		});
		// Add the notes to the `all` warehouse
		inNotesByWarehouse.all.push(...inNotesByWarehouse[warehouse]);
	});
	return inNotesByWarehouse;
});
/** A list of all (non deleted) outbound notes available, used for `/outbound` view note navigation */
export const outNoteList = derived<Writable<NoteStore>, NoteListEntry[]>(outNoteStore, (outNotes) =>
	// If note not deleted, add to out notes list: try and use displayName, otherwise use noteId
	Object.entries(outNotes)
		.filter(([, { state }]) => state !== 'deleted')
		.map(([id, { displayName }]) => ({
			id,
			displayName
		}))
);
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
 * A factory function used to create a store containing the name for a given note. It subscribes to
 * the note content store and updates the interna store with the `displayName` of the note. If the `displayName`
 * of the note is note provided, it will return the `id` of the note instead.
 * @param noteId The id of the note to create a store for.
 * @param type The type (inbound | outbound) of note to create a store for.
 * @returns the internal store containing the `displayName` for the note and a `set` function to update the `displayName` of the note in the note content store.
 */
export const createNoteDisplayNameStore = (noteId: string | undefined, type: 'inbound' | 'outbound') => {
	const contentStore = contentStoreLookup[type];

	// Create an internal store that will contain the displayName of the note
	const currentDisplayName = writable<string>();

	// Subscribe to the content store and update currentDisplayName with the displayName of the note.
	contentStore.subscribe((notes) => {
		// Update the currentDisplayName store with the new displayName if noteId is defined
		// no-op otherwise
		if (noteId) {
			currentDisplayName.set(notes[noteId]?.displayName || noteId);
		}
	});

	// The set function updates the `displayName` for the note in the content store
	const set = (displayName: string) => {
		// Update the note `displayName` if `noteId` is defined
		// No-op otherwise
		if (noteId) {
			contentStore.update((notes) => {
				// Do a no-op of note with given id doesn't exist in the store
				if (!notes[noteId]) {
					return notes;
				}

				notes[noteId].displayName = displayName;
				return notes;
			});
		}
	};

	// Write an update function with the same logic as set
	const update = (fn: (value: string | undefined) => string) => {
		// Update the note `displayName` if `noteId` is defined
		// No-op otherwise
		if (noteId) {
			contentStore.update((notes) => {
				// Do a no-op of note with given id doesn't exist in the store
				if (!notes[noteId]) {
					return notes;
				}

				notes[noteId].displayName = fn(notes[noteId].displayName);
				return notes;
			});
		}
	};

	return { subscribe: currentDisplayName.subscribe, set, update };
};

export const createNoteUpdatedAtStore = (noteId: string | undefined, type: 'inbound' | 'outbound') => {
	const contentStore = contentStoreLookup[type];
	// return a derived store that returns the updatedAt date for the note
	return derived(contentStore, (notes) => {
		if (noteId) {
			return notes[noteId] ? new Date(notes[noteId].updatedAt) : undefined;
		}
	});
};

interface PaginationData {
	numPages: number;
	firstItem: number;
	lastItem: number;
	totalItems: number;
}

interface TableContentStores {
	entries: Readable<DisplayRow[]>;
	currentPage: Writable<number>;
	paginationData: Readable<PaginationData>;
}

interface CreateTableContentStores {
	(
		contentStore: Readable<NoteStore | WarehouseStore>,
		id: string | undefined,
		entriesPerPage?: number
	): TableContentStores;
}

export const createTableContentStores: CreateTableContentStores = (contentStore, id, entriesPerPage = 10) => {
	// Create a store that will contain the current page of the table
	const currentPage = writable(0);

	// Create a store that will contain all of the entries for the warehouse/node
	const allEntries = derived<[Readable<NoteStore | WarehouseStore>, Readable<BookStore>], DisplayRow[]>(
		[contentStore, bookStore],
		([$contentStore, $bookStore]) => {
			// No id will happen quite often: this means we're on root of the view
			// with no single note/warehouse specified.
			if (!id) {
				return [];
			}

			// If the note/warehouse doesn't exist (or is 'deleted', return undefined)
			if (!$contentStore[id] || ($contentStore as NoteStore)[id].state === 'deleted') {
				return [];
			}

			// Return the entries for the note/warehouse extended with the properties of the corresponding book (keyed by isbn)
			return ($contentStore as NoteStore)[id].entries.map(({ isbn, quantity }) => ({
				...$bookStore[isbn],
				quantity,
				isbn
			}));
		}
	);

	// Create a store that will contain the entries for the current page
	const entries = derived<[Readable<DisplayRow[]>, Readable<number>], DisplayRow[]>(
		[allEntries, currentPage],
		([$allEntries, $currentPage]) => {
			// If there are no entries, return an empty array
			if ($allEntries.length === 0) {
				return [];
			}

			// Return the entries for the current page
			return $allEntries.slice($currentPage * entriesPerPage, ($currentPage + 1) * entriesPerPage);
		}
	);

	// Create a store that will contain the pagination data: numPages, firstItem, lastItem, totalItems,
	// derived from the allEntries and currentPage stores
	const paginationData = derived<[Readable<DisplayRow[]>, Readable<number>], PaginationData>(
		[allEntries, currentPage],
		([$allEntries, $currentPage]) => {
			// If there are no entries, return an empty array
			if ($allEntries.length === 0) {
				return {
					numPages: 0,
					firstItem: 0,
					lastItem: 0,
					totalItems: 0
				};
			}

			// Return the entries for the current page
			return {
				numPages: Math.ceil($allEntries.length / entriesPerPage),
				firstItem: $currentPage * entriesPerPage + 1,
				lastItem: Math.min(($currentPage + 1) * entriesPerPage, $allEntries.length),
				totalItems: $allEntries.length
			};
		}
	);

	// Return the created stores
	return {
		entries,
		currentPage,
		paginationData
	};
};

// /**
//  * Creates a store containing the content for table display for a given view.
//  * @param contentType
//  * @returns
//  */
// export const createTableContentStore = (contentStore: Readable<NoteStore | WarehouseStore>, id: string) =>
// 	derived<[Readable<NoteStore | WarehouseStore>, Readable<BookStore>], DisplayRow[]>(
// 		[contentStoreLookup[contentType], bookStore],
// 		([content, bookStore]) => {
// 			// No id will happen quite often: this means we're on root of the view
// 			// with no single note/warehouse specified.
// 			if (!id) {
// 				return [];
// 			}

// 			// If the note/warehouse doesn't exist (or is 'deleted', return undefined)
// 			if (!content[id] || (content as NoteStore)[id].state === NoteState.Deleted) {
// 				return [];
// 			}

// 			return content[id].entries.map(({ isbn, quantity }) => ({
// 				...bookStore[isbn],
// 				isbn,
// 				quantity
// 			}));
// 		}
// 	);
