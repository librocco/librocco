/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Observable } from 'rxjs';
import PouchDB from 'pouchdb';

import type { DocType, NoteState } from './enums';
import { debug } from '@librocco/shared';

// #region utils
/**
 * Used to make one or more properties on the object optional.
 */
export type PickPartial<R extends Record<string, any>, K extends keyof R> = Omit<R, K> & Partial<Pick<R, K>>;
// #endregion utils

// #region misc
export type VersionString = `v${number}`;
export type VersionedString = `${VersionString}/${string}`;

/** A type wrapper around a document in couchdb/pouchdb (adds `_id` and `_rev` to the document structure, passed as type param) */
export type CouchDocument<Doc extends Record<string, any> = Record<string, any>> = {
	_id: VersionedString;
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
	warehouseId: VersionedString;
}

/** An extended version of `VolumeStock`, for client usage (should contain warehouse name as ids are quite ugly to display) */
export interface VolumeStockClient extends VolumeStock {
	warehouseName: string;
}
// #endregion misc

// #region books
export interface BookEntry {
	isbn: string;
	title: string;
	price: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
}
// #endregion books

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
		updatedAt: string | null;
	} & A
>;

/**
 * A standardized interface for streams received from a note
 */
export interface NoteStream {
	state: Observable<NoteState>;
	displayName: Observable<string>;
	updatedAt: Observable<Date | null>;
	entries: Observable<VolumeStockClient[]>;
}

/**
 * A tuple used as param(s) for adding volumes to a note: [isbn, quantity, warehouse?]
 */
export type VolumeTransactionTuple = [string, number, VersionedString] | [string, number];

/**
 * A standardized interface (interface of methods) for a note.
 * Different implementations might vary, but should always extend this interface.
 */
export interface NoteProto<A extends Record<string, any> = {}> {
	// CRUD
	create: () => Promise<NoteInterface<A>>;
	get: () => Promise<NoteInterface<A> | undefined>;
	// NOTE: update is private
	delete: (ctx: debug.DebugCtx) => Promise<void>;

	// Note specific methods
	setName: (name: string, ctx: debug.DebugCtx) => Promise<NoteInterface<A>>;
	addVolumes: (...params: VolumeTransactionTuple | VolumeTransactionTuple[]) => Promise<NoteInterface<A>>;
	updateTransaction: (transaction: VolumeStock) => Promise<NoteInterface<A>>;
	commit: (ctx: debug.DebugCtx) => Promise<NoteInterface<A>>;
	stream: (ctx: debug.DebugCtx) => NoteStream;
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
		displayName: string;
	} & A
>;

/**
 * A standardized interface for streams received from a warehouse
 */
export interface WarehouseStream {
	displayName: Observable<string>;
	entries: Observable<VolumeStockClient[]>;
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
	setName: (name: string, ctx: debug.DebugCtx) => Promise<WarehouseInterface<N, A>>;
	stream: (ctx: debug.DebugCtx) => WarehouseStream;
}

/**
 * A (standardized) full warehouse interface:
 * * standard data structure
 * * standard method interface
 */
export type WarehouseInterface<N extends NoteInterface = NoteInterface, A extends Record<string, any> = {}> = WarehouseProto<N, A> &
	WarehouseData<A>;
// #endregion warehouse

// #region db
export interface NavListEntry {
	id: string;
	displayName: string;
}

export type InNoteList = Array<NavListEntry & { notes: NavListEntry[] }>;

export interface NoteLookupResult<N extends NoteInterface, W extends WarehouseInterface> {
	note: N;
	warehouse: W;
}

export interface FindNote<N extends NoteInterface, W extends WarehouseInterface> {
	(noteId: string): Promise<NoteLookupResult<N, W> | undefined>;
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
export interface DatabaseInterface<W extends WarehouseInterface = WarehouseInterface, N extends NoteInterface = NoteInterface> {
	_pouch: PouchDB.Database;
	updateDesignDoc(doc: DesignDocument): Promise<PouchDB.Core.Response>;
	warehouse: (id?: string) => W;
	findNote: FindNote<N, W>;
	stream: (ctx: debug.DebugCtx) => DbStream;
	init: (params: { remoteDb?: string }, ctx: debug.DebugCtx) => Promise<DatabaseInterface>;
	books: () => BookInterface;
}

/**
 * An interface for books in a db
 */
export interface BookInterface {
	get: (isbns: string[]) => Promise<(BookEntry | undefined)[]>;
	upsert: (bookEntries: BookEntry[]) => Promise<void>;
	stream: (isbns: string[], ctx: debug.DebugCtx) => Observable<BookEntry[]>;
}
export interface NewDatabase {
	(db: PouchDB.Database): DatabaseInterface;
}
// #endregion db
