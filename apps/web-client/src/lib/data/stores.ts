import { writable } from 'svelte/store';

interface BookEntry {
	isbn: string;
	title: string;
	authors: string[];
	publisher: string;
	year: string;
	price: number;
}

interface VolumeQuantity {
	isbn: string;
	quantity: number;
}

interface BookStore {
	[isbn: string]: BookEntry;
}
const bookStore = writable<BookStore>({});

interface WarehouseStore {
	[warehouse: string]: {
		entries: VolumeQuantity[];
		inNotes: string[];
	};
}
const warehouseStore = writable<WarehouseStore>({});

interface NoteStore {
	[noteId: string]: {
		entries: VolumeQuantity[];
	};
}
const inNoteStore = writable<NoteStore>({});
const outNoteStore = writable<NoteStore>({});
