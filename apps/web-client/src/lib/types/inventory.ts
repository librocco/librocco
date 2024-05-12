import type { VolumeStockClient, BookEntry } from "@librocco/db";
import type { NoteState, NoteTempState, VolumeStockKind } from "@librocco/shared";

import type { VolumeQuantity } from "./db";
import type { NoteType, InventoryDatabaseInterface } from "@librocco/db";
import type { Observable } from "rxjs";
import type { Readable } from "svelte/motion";
import type { VolumeStock, debug } from "@librocco/shared";
import type { WarehouseDataMap } from "@librocco/db";

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

type VolumeStockBook = VolumeStock<"book">;

export interface Result {
	bookList: (VolumeStockBook & BookEntry & { warehouseName: string; committedAt: string; noteType: NoteType })[];
	stats: {
		totalInboundBookCount: number;
		totalInboundCoverPrice: number;
		totalOutboundBookCount: number;
		totalOutboundCoverPrice: number;
		totalOutboundDiscountedPrice: number;
		totalInboundDiscountedPrice: number;
	};
}

export interface CreateDisplayEntriesStore {
	(
		ctx: debug.DebugCtx,
		db: InventoryDatabaseInterface,
		committedNotesListStream: Observable<
			Map<
				string,
				(VolumeStockBook & {
					noteType: "inbound" | "outbound";
				} & {
					committedAt: string;
				})[]
			>
		>,
		warehouseListStream: Observable<WarehouseDataMap>,
		dateValue: Readable<any>
	): {
		result: Readable<Result>;
	};
}
