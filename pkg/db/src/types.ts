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
	warehouseId?: string;
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
	/** Set name updates the `displayName` of the note. */
	setName: (name: string, ctx: debug.DebugCtx) => Promise<NoteInterface<A>>;
	/**
	 * Add volumes accepts an array of volume stock entries and adds them to the note.
	 * If any transactions (for a given isbn and warehouse) already exist, the quantity gets aggregated.
	 */
	addVolumes: (...params: VolumeStock[]) => Promise<NoteInterface<A>>;
	/** Explicitly update an existing transaction row.
	 * the transaction is matched with both isbn and warehouseId.
	 * If entry with the same isbn previously has no warehouseId and
	 * a warehouseId was provided, the empty warehouseId will be overwritten
	 */
	updateTransaction: (transaction: VolumeStock) => Promise<NoteInterface<A>>;
	/** Commit the note, no updates to the note (except updates to `displayName`) can be performed after this. */
	commit: (ctx: debug.DebugCtx) => Promise<NoteInterface<A>>;
	/**
	 * Stream returns an object containing observable streams for the note:
	 * - `state` - streams the note's `state`
	 * - `displayName` - streams the note's `displayName`
	 * - `updatedAt` - streams the note's `updatedAt`
	 * - `entries` - streams the note's `entries` (volume transactions)
	 */
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

	/** Note constructs a note interface for the note with the provided id. If ommitted, a new (timestamped) id is generated (for note creation). */
	note: (id?: string) => N;
	/** Set name udpates the `displayName` of the warehouse */
	setName: (name: string, ctx: debug.DebugCtx) => Promise<WarehouseInterface<N, A>>;
	/**
	 * Stream returns an object containing observable streams for the warehouse:
	 * - `displayName` - streams the warehouse's `displayName`
	 * - `entries` - streams the warehouse's `entries` (stock)
	 */
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
	/** A reference to the pouch db instance the db interface was built around. */
	_pouch: PouchDB.Database;
	/** Update design doc is here more for internal usage and, shouldn't really be called explicitly (call `db.init` instead). */
	updateDesignDoc(doc: DesignDocument): Promise<PouchDB.Core.Response>;
	/** Warehouse returns a warehouse interface for a given warehouse id. If no id is provided, it falls back to the default (`0-all`) warehouse. */
	warehouse: (id?: string) => W;
	/**
	 * Find note accepts a note id and returns:
	 * - if note exists: the note interface and warehouse interface for its parent warehouse
	 * - if note doesn't exist: `undefined`
	 */
	findNote: FindNote<N, W>;
	/**
	 * Stream returns an object containing note streams:
	 * - `warehouseList` - a stream of warehouse list entries (for navigation)
	 * - `outNoteList` a stream of out note list entries (for navigation)
	 * - `inNoteList` - a stream of in note list entries (for navigation)
	 */
	stream: (ctx: debug.DebugCtx) => DbStream;
	/**
	 * Init initialises the db:
	 * - creates the default warehouse
	 * - uploads the design docs
	 * - opens the db replication (if remote db address provided)
	 *
	 * _Note: this has to be called only the first time the db is initialised (unless using live replication), but is
	 * idempotent in nature and it's good to run it each time the app is loaded (+ it's necessary if using live replication)._
	 */
	init: (params: { remoteDb?: string }, ctx: debug.DebugCtx) => Promise<DatabaseInterface>;
	/**
	 * Books constructs an interface used for book operations agains the db:
	 * - `get` - accepts an array of isbns and returns a same length array of book data or `undefined`.
	 * - `upsert` - accepts an array of book data and upserts them into the db. If a book data already exists, it will be
	 * updated, otherwise it will be created.
	 * - `stream` - accepts an array of isbns and returns a stream, streaming an array of same length, containing book data or `undefined`.
	 */
	books: () => BooksInterface;
}

/**
 * An interface for books in a db
 */
export interface BooksInterface {
	/**
	 * Get accepts an array of isbns and returns a same length array of book data or `undefined`.
	 *
	 * _Note: we can guarantee that the result array will be the same length as the input array, as well
	 * as the results being in the same order as the input array: a book data at index 'i' will correspond to the isbn at
	 * index 'i' of the request array, if the book data doesn't exist in the db, `undefined` will be found at its place._
	 */
	get: (isbns: string[]) => Promise<(BookEntry | undefined)[]>;
	/**
	 * Upsert accepts an array of book data and upserts them into the db. If a book data already exists, it will be
	 * updated, otherwise it will be created.
	 */
	upsert: (bookEntries: BookEntry[]) => Promise<void>;
	/**
	 * Stream accepts an array of isbns and streams a same length array of book data or `undefined`.
	 *
	 * _Note: we can guarantee that each streamed value will be an array of the same length as the input array, as well
	 * as the results being in the same order as the input array: a book data at index 'i' will correspond to the isbn at
	 * index 'i' of the request array, if the book data doesn't exist in the db, `undefined` will be found at its place._
	 */
	stream: (isbns: string[], ctx: debug.DebugCtx) => Observable<(BookEntry | undefined)[]>;
}

export interface NewDatabase {
	(db: PouchDB.Database): DatabaseInterface;
}
// #endregion db
