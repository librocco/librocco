/* eslint-disable @typescript-eslint/ban-types */
import { Observable } from "rxjs";

import { debug, type StockMap, type VolumeStock } from "@librocco/shared";

import {
	InventoryDatabaseInterface as IDI,
	OrdersDatabaseInterface as ODI,
	DatabaseInterface as DI,
	WarehouseInterface as WI,
	WarehouseData as WD,
	NoteInterface as NI,
	NoteData as ND,
	CustomerOrderInterface as COI,
	CustomerOrderData as COD,
	WarehouseDataMap,
	NavEntry,
	WarehouseProto
} from "@/types";
import { DocType } from "@/enums";

/** Both the warehouse and note have additional `entries` field in this implementation */
export type AdditionalNoteData = CouchDocument<{
	entries: VolumeStock[];
	defaultWarehouseId?: string;
}>;

/** Note data (extended with additional fields) for internal implementation usage. */
export type NoteData = ND<AdditionalNoteData>;
export type NoteInterface = NI<AdditionalNoteData>;

/** Warehouse data (extended with additional fields) for internal implementation usage. */
export type WarehouseData = CouchDocument<WD>;
export type WarehouseInterface = WI<NoteInterface, WarehouseProto & WarehouseData>;
export type InventoryDatabaseInterface = IDI<
	WarehouseInterface,
	NoteInterface,
	{
		_pouch: PouchDB.Database;
		view<R extends MapReduceRow, M extends CouchDocument = CouchDocument>(name: string): ViewInterface<R, M>;
		getStock: () => Promise<StockMap>;
		getWarehouseDataMap: () => Promise<WarehouseDataMap>;
		updateDesignDoc(doc: DesignDocument): Promise<PouchDB.Core.Response>;
		buildIndices: () => Promise<void>;
	}
>;

export interface ViewInterface<R extends MapReduceRow, M extends CouchDocument> {
	query: (opts?: PouchDB.Query.Options<M, R>) => Promise<MapReduceRes<R, M>>;
	changes: () => PouchDB.Core.Changes<M>;
	changesStream: (ctx: debug.DebugCtx, opts?: PouchDB.Core.ChangesOptions) => Observable<PouchDB.Core.ChangesResponseChange<M>>;
	stream: (ctx: debug.DebugCtx, opts?: PouchDB.Query.Options<M, R>) => Observable<MapReduceRes<R, M>>;
}

// Orders datbase interface
export type CustomerOrderData = CouchDocument<COD>;
export type CustomerOrderInterface = COI<CustomerOrderData>;
export type OrdersDatabaseInterface = ODI<CustomerOrderInterface, { _pouch: PouchDB.Database }>;

export type DatabaseInterface = DI<{ _pouch: PouchDB.Database }>;

// #region misc
export type VersionString = `v${number}`;
export type VersionedString = `${VersionString}/${string}`;

/** A type wrapper around a document in couchdb/pouchdb (adds `_id` and `_rev` to the document structure, passed as type param) */
export type CouchDocument<Doc extends Record<string, any> = Record<string, any>> = {
	_id: VersionedString;
	docType: DocType;
	_rev?: string | undefined;
	_deleted?: boolean;
} & Doc;

// #region map-reduce
export type DesignDocument = {
	_id: `_design/${string}`;
	filters?: Record<string, string>;
	views: Record<string, { map: string; filter?: string; reduce?: string }>;
};

/** A utility type used to construct a response we get from the map/reduce (view) query */
export type MapReduceRow<K = any, V = any> = {
	id: string;
	key: K;
	value: V;
};

export type MapReduceRes<R extends MapReduceRow, M extends CouchDocument> = {
	rows: Array<R & { doc?: M }>;
};

export type WarehouseListRow = MapReduceRow<string, NavEntry<Pick<WarehouseData, "discountPercentage">>>;
export type OutNoteListRow = MapReduceRow<string, NavEntry<{ committed?: boolean }>>;
export type InNoteListRow = MapReduceRow<string, NavEntry<{ committed?: boolean; type: DocType }>>;
export type PublishersListRow = MapReduceRow<string, number>;
