import type { NoteTempState } from '$lib/enums/inventory';
import type { NoteState } from '$lib/enums/db';

import type { VolumeQuantity } from './db';

/**
 * An interface for a full book entry, used to type the entries in books store and
 * as part of the `DisplayRow` structure.
 */
export interface BookEntry {
	isbn: string;
	title: string;
	authors?: string[];
	publisher?: string;
	year?: string;
	price?: number;
}

/** A structure of the books store: `readable<BookStore>()`. */
export interface BookStore {
	[isbn: string]: BookEntry;
}

/** The properties of a book + quantity row shown in the note/warehouse table. */
export type DisplayRow = BookEntry & { quantity: number };

export interface WarehouseEntry {
	entries: VolumeQuantity[];
	inNotes?: string[];
	displayName?: string;
}

/** A structure of the warehouse store: `readable<WarehouseStore>()`. */
export interface WarehouseStore {
	[warehouse: string]: WarehouseEntry;
}

export interface NoteEntry {
	displayName?: string;
	entries: VolumeQuantity[];
	updatedAt: string;
	state: NoteState;
}

/** A structure of the note store (inNoteStore or outNoteStore): `writable<NoteStore>()`. */
export interface NoteStore {
	[noteId: string]: NoteEntry;
}

/** A union type for note states used in the client app */
export type NoteAppState = NoteState | NoteTempState | undefined;

/**
 * A structure of the store streaming pagination date for the purpose of displaying pagination element as well as some
 * state on currently shown entries, total entries, etc.
 */
export interface PaginationData {
	numPages: number;
	firstItem: number;
	lastItem: number;
	totalItems: number;
}
