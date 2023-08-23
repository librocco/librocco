/* eslint-disable @typescript-eslint/ban-types */
import { Observable } from "rxjs";

import { debug, StockMap } from "@librocco/shared";

import {
	DatabaseInterface as DI,
	WarehouseInterface as WI,
	WarehouseData as WD,
	NoteInterface as NI,
	NoteData as ND,
	VolumeStock,
	MapReduceRow,
	CouchDocument,
	MapReduceRes,
	NavMap,
	PluginInterfaceLookup,
	LibroccoPlugin
} from "@/types";
import { DocType } from "@/enums";

/** Both the warehouse and note have additional `entries` field in this implementation */
export type AdditionalData = {
	entries: VolumeStock[];
};

/** Note data (extended with additional fields) for internal implementation usage. */
export type NoteData = ND<AdditionalData>;
export type NoteInterface = NI<AdditionalData>;

/** Warehouse data (extended with additional fields) for internal implementation usage. */
export type WarehouseData = WD;
export type WarehouseInterface = WI<NoteInterface>;

export type DatabaseInterface = DI<WarehouseInterface, NoteInterface> & {
	view: <R extends MapReduceRow, M extends CouchDocument = CouchDocument>(name: string) => ViewInterface<R, M>;
	stock: () => Observable<StockMap>;
	getStock: () => Promise<StockMap>;
	getWarehouseList: () => Promise<NavMap>;
};

export interface ViewInterface<R extends MapReduceRow, M extends CouchDocument> {
	query: (opts?: PouchDB.Query.Options<M, R>) => Promise<MapReduceRes<R, M>>;
	changes: () => PouchDB.Core.Changes<M>;
	changesStream: (ctx: debug.DebugCtx, opts?: PouchDB.Core.ChangesOptions) => Observable<PouchDB.Core.ChangesResponseChange<M>>;
	stream: (ctx: debug.DebugCtx, opts?: PouchDB.Query.Options<M, R>) => Observable<MapReduceRes<R, M>>;
}

// View response types
export type WarehouseListRow = MapReduceRow<string, { displayName?: string }>;
export type OutNoteListRow = MapReduceRow<string, { displayName?: string; committed?: boolean }>;
export type InNoteListRow = MapReduceRow<string, { displayName?: string; committed?: boolean; type: DocType }>;
export type PublishersListRow = MapReduceRow<string, number>;

// Plugins
export type PluginLookup = {
	[K in keyof PluginInterfaceLookup]: LibroccoPlugin<PluginInterfaceLookup[K]>;
};
