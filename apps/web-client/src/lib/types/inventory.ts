import type { VolumeStockClient, BookEntry, PastTransaction } from "@librocco/db";
import type { NoteState, NoteTempState, VolumeStockKind } from "@librocco/shared";

import type { VolumeQuantity } from "./db";
import type { Readable } from "svelte/store";

/**
 * An interface for a full book entry, used to type the entries in books store and
 * as part of the `DisplayRow` structure.
 */
/** @TEMP this is needed until all data has been migrated to BookEntry type */
export interface TempBookEntry {
	isbn: string;
	title: string;
	authors?: string[];
	publisher?: string;
	year?: string;
	price?: number;
}

/** A structure of the books store: `readable<BookStore>()`. */
export interface BookStore {
	[isbn: string]: TempBookEntry;
}

/** The properties of a book + quantity row shown in the note/warehouse table. */
export type DisplayRow<K extends VolumeStockKind = VolumeStockKind> = K extends "custom"
	? VolumeStockClient<"custom">
	: VolumeStockClient<K> & BookEntry;

/** A structure of the warehouse store: `readable<WarehouseStore>()`. */
export interface WarehouseStore {
	[warehouse: string]: {
		entries: VolumeQuantity[];
		inNotes?: string[];
		displayName?: string;
	};
}

/** A structure of the note store (inNoteStore or outNoteStore): `writable<NoteStore>()`. */
export interface NoteStore {
	[noteId: string]: {
		displayName?: string;
		defaultWarehouseId?: string;
		entries: VolumeQuantity[];
		updatedAt: string;
		committedAt?: string;
		state: NoteState;
	};
}

/** A structure of the daily summary store (for daily summary part of the history section) */
export interface DailySummaryStore {
	bookList: (PastTransaction & BookEntry & { warehouseName })[];
	stats: {
		totalInboundBookCount: number;
		totalInboundCoverPrice: number;
		totalOutboundBookCount: number;
		totalOutboundCoverPrice: number;
		totalOutboundDiscountedPrice: number;
		totalInboundDiscountedPrice: number;
	};
}

export interface BookHistoryStores {
	transactions: Readable<(PastTransaction & { warehouseName: string })[]>;
	bookData: Readable<BookEntry>;
}

/** A union type for note states used in the client app */
export type NoteAppState = NoteState | NoteTempState | undefined;
