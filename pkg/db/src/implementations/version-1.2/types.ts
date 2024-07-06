/* eslint-disable @typescript-eslint/ban-types */
import { Observable } from "rxjs";

import { debug, type StockMap, type VolumeStock } from "@librocco/shared";

import {
	InventoryDatabaseInterface as IDI,
	OrdersDatabaseInterface as ODI,
	WarehouseInterface as WI,
	WarehouseData as WD,
	NoteInterface as NI,
	NoteData as ND,
	MapReduceRow,
	CouchDocument,
	MapReduceRes,
	WarehouseDataMap,
	NavEntry
} from "@/types";
import { DocType } from "@/enums";
import { StockInterface } from "./stock";

/** Both the warehouse and note have additional `entries` field in this implementation */
export type AdditionalData = {
	entries: VolumeStock[];
	defaultWarehouseId?: string;
};

/** Note data (extended with additional fields) for internal implementation usage. */
export type NoteData = ND<AdditionalData>;
export type NoteInterface = NI<AdditionalData>;

/** Warehouse data (extended with additional fields) for internal implementation usage. */
export type WarehouseData = WD;
export type WarehouseInterface = WI<NoteInterface>;
export type InventoryDatabaseInterface = IDI<WarehouseInterface, NoteInterface> & {
	view<R extends MapReduceRow, M extends CouchDocument = CouchDocument>(name: string): ViewInterface<R, M>;
	getStock: (endDate?: Date) => Promise<StockMap>;
	getWarehouseDataMap: () => Promise<WarehouseDataMap>;
	archive(): ArchiveInterface;
	stock(): StockInterface;
};

export interface ViewInterface<R extends MapReduceRow, M extends CouchDocument> {
	query: (opts?: PouchDB.Query.Options<M, R>) => Promise<MapReduceRes<R, M>>;
	changes: () => PouchDB.Core.Changes<M>;
	changesStream: (ctx: debug.DebugCtx, opts?: PouchDB.Core.ChangesOptions) => Observable<PouchDB.Core.ChangesResponseChange<M>>;
	stream: (ctx: debug.DebugCtx, opts?: PouchDB.Query.Options<M, R>) => Observable<MapReduceRes<R, M>>;
}

// View response types
export type WarehouseListRow = MapReduceRow<string, NavEntry<Pick<WarehouseData, "discountPercentage">>>;
export type OutNoteListRow = MapReduceRow<string, NavEntry<{ committed?: boolean }>>;
export type InNoteListRow = MapReduceRow<string, NavEntry<{ committed?: boolean; type: DocType }>>;
export type PublishersListRow = MapReduceRow<string, number>;

// Orders datbase interface
export type OrdersDatabaseInterface = ODI;

// Archive
export type StockArchiveDoc = CouchDocument<{
	month: string;
	entries: VolumeStock[];
	// Checksum ??
}>;

export interface StockArchiveInterface extends StockArchiveDoc {
	get(): Promise<StockArchiveInterface>;
	upsert(ctx: debug.DebugCtx, month: string, entries: VolumeStock[]): Promise<StockArchiveInterface>;
}

export interface ArchiveInterface {
	stock(): StockArchiveInterface;
}
