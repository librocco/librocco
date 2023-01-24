import type { Writable } from 'svelte/store';
import type { Observable } from 'rxjs';

<<<<<<< HEAD
import type { BookStore, NoteStore, WarehouseStore } from './inventory';
=======
import type { NoteStore, WarehouseStore } from './inventory';
>>>>>>> main
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
	state: Observable<NoteState | undefined>;
	displayName: Observable<string | undefined>;
	updatedAt: Observable<Date | undefined>;
	entries: Observable<VolumeQuantity[]>;
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
	displayName: Observable<string | undefined>;
	entries: Observable<VolumeQuantity[]>;
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
	id: string;
	warehouse: string;
	type: 'inbound' | 'outbound';
	state: NoteState;
	displayName?: string;
}

interface FindNote {
	(noteId: string): NoteLookupResult | undefined;
}

export interface DbStream {
<<<<<<< HEAD
	bookStock: Observable<BookStore>;
	warehouseStock: Observable<WarehouseStore>;
=======
>>>>>>> main
	warehouseList: Observable<NavListEntry[]>;
	outNoteList: Observable<NavListEntry[]>;
	inNoteList: Observable<InNoteList>;
	findNote: Observable<FindNote>;
}

export interface DbInterface {
	warehouse: (id?: string) => WarehouseInterface;
	stream: () => DbStream;
}
// #endregion db
