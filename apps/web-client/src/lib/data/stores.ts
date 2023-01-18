import { readable, derived, type Readable } from 'svelte/store';
import { page } from '$app/stores';

import allBooks from './books';
import allWarehouse from './warehouses';
import allInbound from './notes/inbound';
import allOutbound from './notes/outbound';

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
	};
}
const inNoteStore = readable<NoteStore>(allInbound);
const outNoteStore = readable<NoteStore>(allOutbound);

export const warehouses = derived(warehouseStore, (ws) => Object.keys(ws));
export const inNotes = derived(warehouseStore, (ws) =>
	Object.entries(ws).reduce(
		(acc, [wName, { inNotes }]) => ({ ...acc, [wName]: inNotes || [] }),
		{} as Record<string, string[]>
	)
);
export const outNotes = derived(outNoteStore, (on) => Object.keys(on));

const contentStoreLookup = {
	stock: warehouseStore,
	inbound: inNoteStore,
	outbound: outNoteStore
};
export const createTableContentStore = (contentType: keyof typeof contentStoreLookup) =>
	derived<[Readable<NoteStore>, typeof page, Readable<BookStore>], DisplayRow[]>(
		[contentStoreLookup[contentType], page, bookStore],
		([content, page, bookStore]) => {
			const { id } = page.params as { id?: string };

			// No id will happen quite ofter: this means we're on root of the view
			// with no single note specified.
			if (!id) {
				return [];
			}

			// TODO: we might want to throw 404 here...
			if (!content[id]) {
				return [];
			}

			return content[id].entries.map(({ isbn, quantity }) => ({
				...bookStore[isbn],
				isbn,
				quantity
			}));
		}
	);
