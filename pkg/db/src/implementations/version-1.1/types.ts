import { Observable } from "rxjs";

import { debug } from "@librocco/shared";

import {
	DatabaseInterface as DI,
	WarehouseInterface as WI,
	WarehouseData as WD,
	NoteInterface as NI,
	NoteData as ND,
	VolumeStock,
	MapReduceRow,
	CouchDocument,
	MapReduceRes
} from "@/types";

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
	view: <R extends MapReduceRow, M extends CouchDocument>(name: string) => ViewInterface<R, M>;
};

export type WarehouseListViewResp = {
	key: string;
	value: { displayName?: string };
};
export type NoteListViewResp = {
	key: string;
	value: { displayName?: string; committed?: boolean };
};

export interface ViewInterface<R extends MapReduceRow, M extends CouchDocument> {
	query: (opts?: PouchDB.Query.Options<M, R>) => Promise<MapReduceRes<R, M>>;
	changes: () => PouchDB.Core.Changes<M>;
	changesStream: (ctx: debug.DebugCtx, opts?: PouchDB.Core.ChangesOptions) => Observable<PouchDB.Core.ChangesResponseChange<M>>;
	stream: (ctx: debug.DebugCtx, opts?: PouchDB.Query.Options<M, R>) => Observable<MapReduceRes<R, M>>;
}
