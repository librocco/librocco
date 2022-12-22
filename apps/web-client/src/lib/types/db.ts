import type { Readable, Writable } from 'svelte/store';

import type { NoteStore, WarehouseStore } from './inventory';
import type { NoteState } from '$lib/enums/db';

// #region misc
/** An interface representing the way book quantity is stored in the db, be it transaction (notes) or stock (warehouse/all stock) */
export interface VolumeQuantity {
	isbn: string;
	quantity: number;
}

export interface Stores {
	warehouseStore: Writable<WarehouseStore>;
	inNoteStore: Writable<NoteStore>;
	outNoteStore: Writable<NoteStore>;
}
// #endregion misc

// #region note
export interface NoteStream {
	state: Readable<NoteState | undefined>;
	displayName: Readable<string | undefined>;
	updatedAt: Readable<Date | undefined>;
	entries: Readable<VolumeQuantity[]>;
}

export interface NoteInterface {
	commit: () => Promise<void>;
	delete: () => Promise<void>;
	setName: (name: string) => Promise<void>;
	stream: () => NoteStream;
}
// #endregion note

// #region warehouse
export interface WarehouseStream {
	displayName: Readable<string | undefined>;
	entries: Readable<VolumeQuantity[]>;
}

export interface WarehouseInterface {
	setName: (name: string) => Promise<void>;
	note: (noteId: string) => NoteInterface;
	stream: () => WarehouseStream;
}
// #endregion warehouse

// #region db
export interface NavListEntry {
	id: string;
	displayName?: string;
}

export type InNoteList = Array<NavListEntry & { notes: NavListEntry[] }>;

export interface NoteLookupResult {
	warehouse: string;
	type: 'inbound' | 'outbound';
	state: NoteState;
}

interface CheckNote {
	(noteId: string): NoteLookupResult | undefined;
}

export interface DbStream {
	warehouseList: Readable<NavListEntry[]>;
	outNoteList: Readable<NavListEntry[]>;
	inNoteList: Readable<InNoteList>;
	checkNote: Readable<CheckNote>;
}

export interface DbInterface {
	warehouse: (id?: string) => WarehouseInterface;
	stream: () => DbStream;
}
// #endregion db
