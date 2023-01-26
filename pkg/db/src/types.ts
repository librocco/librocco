/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Observable } from 'rxjs';
import PouchDB from 'pouchdb';

import type { DocType, NoteState } from './enums';

// #region utils
/**
 * Used to make one or more properties on the object optional.
 */
export type PickPartial<R extends Record<string, any>, K extends keyof R> = Omit<R, K> & Partial<Pick<R, K>>;
// #endregion utils

// #region misc
/** A type wrapper around a document in couchdb/pouchdb (adds `_id` and `_rev` to the document structure, passed as type param) */
export type CouchDocument<Doc extends Record<string, any> = Record<string, any>> = {
	_id: string;
	docType: DocType;
	_rev?: string | undefined;
} & Doc;

export type DesignDocument = {
	_id: `_design/${string}`;
	filters?: Record<string, string>;
	views: Record<string, { map: string; filter?: string; reduce?: string }>;
};

/** An interface representing the way book quantity is stored in the db, be it transaction (notes) or stock (warehouse/all stock) */
export interface VolumeStock {
	isbn: string;
	quantity: number;
	warehouse: string;
}
// #endregion misc

// #region note
export type NoteType = 'inbound' | 'outbound';

/**
 * Standardized data that should be present in any note
 * (different implementations might differ, but should extend this structure)
 */
export type NoteData<A extends Record<string, any> = {}> = CouchDocument<
	{
		noteType: NoteType;
		committed: boolean;
		displayName: string;
		updatedAt: string;
	} & A
>;

/**
 * A standardized interface for streams received from a note
 */
export interface NoteStream {
	state: Observable<NoteState | undefined>;
	displayName: Observable<string | undefined>;
	updatedAt: Observable<Date | undefined>;
	entries: Observable<VolumeStock[]>;
}

/**
 * A tuple used as param(s) for adding volumes to a note: [isbn, quantity, warehouse?]
 */
export type VolumeTransactionTuple = [string, number, string] | [string, number];

/**
 * A standardized interface (interface of methods) for a note.
 * Different implementations might vary, but should always extend this interface.
 */
export interface NoteProto<A extends Record<string, any> = {}> {
	// CRUD
	create: () => Promise<NoteInterface<A>>;
	get: () => Promise<NoteInterface<A> | undefined>;
	// NOTE: update is private
	delete: () => Promise<void>;

	// Note specific methods
	setName: (name: string) => Promise<NoteInterface<A>>;
	addVolumes: (...params: VolumeTransactionTuple | VolumeTransactionTuple[]) => Promise<NoteInterface<A>>;
	updateTransaction: (transaction: VolumeStock) => Promise<NoteInterface<A>>;
	commit: () => Promise<NoteInterface<A>>;
	stream: () => NoteStream;
}

/**
 * A (standardized) full note interface:
 * * standard data structure
 * * standard method interface
 */
export type NoteInterface<A extends Record<string, any> = {}> = NoteProto<A> & NoteData<A>;
// #endregion note

// #region warehouse
/**
 * Standardized data that should be present in any note
 * (different implementations might differ, but should extend this structure)
 */
export type WarehouseData<A extends Record<string, any> = {}> = CouchDocument<
	{
		displayName?: string;
	} & A
>;

/**
 * A standardized interface for streams received from a warehouse
 */
export interface WarehouseStream {
	displayName: Observable<string | undefined>;
	entries: Observable<VolumeStock[]>;
}

/**
 * A standardized interface (interface of methods) for a warehouse.
 * Different implementations might vary, but should always extend this interface.
 */
export interface WarehouseProto<N extends NoteInterface = NoteInterface, A extends Record<string, any> = {}> {
	// CRUD
	create: () => Promise<WarehouseInterface<N, A>>;
	get: () => Promise<WarehouseInterface<N, A> | undefined>;
	// NOTE: update is private
	delete: () => Promise<void>;

	note: (id?: string) => N;
	setName: (name: string) => Promise<WarehouseInterface<N, A>>;
	stream: () => WarehouseStream;
}

/**
 * A (standardized) full warehouse interface:
 * * standard data structure
 * * standard method interface
 */
export type WarehouseInterface<
	N extends NoteInterface = NoteInterface,
	A extends Record<string, any> = {}
> = WarehouseProto<N, A> & WarehouseData<A>;
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

export interface FindNote {
	(noteId: string): NoteLookupResult | undefined;
}

/**
 * A standardized interface for streams received from a db
 */
export interface DbStream {
	warehouseList: Observable<NavListEntry[]>;
	outNoteList: Observable<NavListEntry[]>;
	inNoteList: Observable<InNoteList>;
}

/**
 * A standardized interface (interface of methods) for a db.
 */
export interface DatabaseInterface<
	W extends WarehouseInterface = WarehouseInterface,
	N extends NoteInterface = NoteInterface
> {
	_pouch: PouchDB.Database;
	updateDesignDoc(doc: DesignDocument): Promise<PouchDB.Core.Response>;
	warehouse: (id?: string) => W;
	findNote: (id: string) => Promise<N | undefined>;
	stream: () => DbStream;
}
// #endregion db
