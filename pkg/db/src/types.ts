/* eslint-disable @typescript-eslint/ban-types */

import type { Observable } from "rxjs";
import PouchDB from "pouchdb";

import { debug } from "@librocco/shared";

import type { DocType, NoteState } from "./enums";

import { NEW_WAREHOUSE } from "./constants";

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
	warehouseId: string;
}

/** An extended version of `VolumeStock`, for client usage (should contain warehouse name as ids are quite ugly to display) */
export interface VolumeStockClient extends VolumeStock {
	warehouseName: string;
	availableWarehouses?: { value: string; label: string }[];
}

export interface EntriesStreamResult {
	rows: VolumeStockClient[];
	total: number;
	totalPages: number;
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
export type NoteType = "inbound" | "outbound";

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
	state: (ctx: debug.DebugCtx) => Observable<NoteState>;
	displayName: (ctx: debug.DebugCtx) => Observable<string>;
	updatedAt: (ctx: debug.DebugCtx) => Observable<Date | null>;
	entries: (ctx: debug.DebugCtx, page?: number, itemsPerPage?: number) => Observable<EntriesStreamResult>;
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
	setName: (ctx: debug.DebugCtx, name: string) => Promise<NoteInterface<A>>;
	/**
	 * Add volumes accepts an array of volume stock entries and adds them to the note.
	 * If any transactions (for a given isbn and warehouse) already exist, the quantity gets aggregated.
	 */
	addVolumes: (...params: PickPartial<VolumeStock, "warehouseId">[]) => Promise<NoteInterface<A>>;
	/**
	 * Explicitly update an existing transaction row.
	 * The transaction is matched by both isbn and warehouseId.
	 */
	updateTransaction: (match: PickPartial<Omit<VolumeStock, "quantity">, "warehouseId">, update: VolumeStock) => Promise<NoteInterface<A>>;
	/**
	 * Remove "row" from note transactions .
	 * The transaction is matched by both isbn and warehouseId.
	 */
	removeTransactions: (...transactions: Omit<VolumeStock, "quantity">[]) => Promise<NoteInterface<A>>;
	/**
	 * Commit the note, no updates to the note (except updates to `displayName`) can be performed after this.
	 * @param ctx debug context
	 * @param options object
	 * @param options.force force commit, even if the note is empty (this should be used only in tests)
	 */
	commit: (ctx: debug.DebugCtx, options?: { force: true }) => Promise<NoteInterface<A>>;
	/**
	 * Stream returns an object containing observable streams for the note:
	 * - `state` - streams the note's `state`
	 * - `displayName` - streams the note's `displayName`
	 * - `updatedAt` - streams the note's `updatedAt`
	 * - `entries` - streams the note's `entries` (volume transactions)
	 */
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
		displayName: string;
	} & A
>;

/**
 * A standardized interface for streams received from a warehouse
 */
export interface WarehouseStream {
	displayName: (ctx: debug.DebugCtx) => Observable<string>;
	entries: (ctx: debug.DebugCtx, page?: number, itemsPerPage?: number) => Observable<EntriesStreamResult>;
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
	setName: (ctx: debug.DebugCtx, name: string) => Promise<WarehouseInterface<N, A>>;
	/**
	 * Stream returns an object containing observable streams for the warehouse:
	 * - `displayName` - streams the warehouse's `displayName`
	 * - `entries` - streams the warehouse's `entries` (stock)
	 */
	stream: () => WarehouseStream;
}

/**
 * A (standardized) full warehouse interface:
 * * standard data structure
 * * standard method interface
 */
export type WarehouseInterface<N extends NoteInterface = NoteInterface, A extends Record<string, any> = {}> = WarehouseProto<N, A> &
	WarehouseData<A>;
// #endregion warehouse

// #region replication
// eslint-disable-next-line @typescript-eslint/ban-types
export type Replication = PouchDB.Replication.ReplicationEventEmitter<any, any, any>;

export interface ReplicatorRes {
	replication: Replication;
	promise: () => Promise<void>;
}

export interface Replicator {
	/**
	 * To sets up a transient replcation from the local db (to the remote db). It returns the `replication`
	 * object and a `promise` method that resolves when the replication is done and the first value from db is updated.
	 * @param ctx debug context
	 * @param url remote db url
	 */
	to: (ctx: debug.DebugCtx, url: string) => ReplicatorRes;
	/**
	 * From sets up a transient replication from the remote db (to the local db). It returns the `replication`
	 * object and a `promise` method that resolves when the replication is done and the first value from db is updated.
	 * @param ctx debug context
	 * @param url remote db url
	 */
	from: (ctx: debug.DebugCtx, url: string) => ReplicatorRes;
	/**
	 * Sync sets up a bidirectional, transient replication between two db instances. It returns the `replication`
	 * object and a `promise` method that resolves when the replication is done and the first value from db is updated.
	 * @param ctx debug context
	 * @param url remote db url
	 */
	sync: (ctx: debug.DebugCtx, url: string) => ReplicatorRes;
	/**
	 * Live sets up a live, bidirectional replication between two db instances. It returns the `replication`
	 * object and a `promise` method that resolves immediately (as the replication is ongoing).
	 * @param ctx debug context
	 * @param url remote db url
	 */
	live: (ctx: debug.DebugCtx, url: string) => ReplicatorRes;
}
// #endregion replication

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
	warehouseList: (ctx: debug.DebugCtx) => Observable<NavListEntry[]>;
	outNoteList: (ctx: debug.DebugCtx) => Observable<NavListEntry[]>;
	inNoteList: (ctx: debug.DebugCtx) => Observable<InNoteList>;
}

/**
 * A standardized interface (interface of methods) for a db.
 */
export interface DatabaseInterface<W extends WarehouseInterface = WarehouseInterface, N extends NoteInterface = NoteInterface> {
	/** A reference to the pouch db instance the db interface was built around. */
	_pouch: PouchDB.Database;
	/** Update design doc is here more for internal usage and, shouldn't really be called explicitly (call `db.init` instead). */
	updateDesignDoc(doc: DesignDocument): Promise<PouchDB.Core.Response>;
	/**
	 * Warehouse returns a warehouse interface for a given warehouse id.
	 * If no id is provided, it falls back to the default (`0-all`) warehouse.
	 *
	 * To assign a new unique id to the warehouse, use `NEW_WAREHOUSE` as the id.
	 * @example
	 * ```ts
	 * import { NEW_WAREHOUSE } from '@librocco/db';
	 * const newWarehouse = db.warehouse(NEW_WAREHOUSE);
	 * ```
	 */
	warehouse: (id?: string | typeof NEW_WAREHOUSE) => W;
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
	stream: () => DbStream;
	/**
	 * Init initialises the db:
	 * - creates the default warehouse
	 * - uploads the design docs
	 *
	 * _Note: this has to be called only the first time the db is initialised (unless using live replication), but is
	 * idempotent in nature and it's good to run it each time the app is loaded (+ it's necessary if using live replication)._
	 */
	init: () => Promise<DatabaseInterface>;
	/**
	 * Sets up replication by returning four methods that enable the client to schedule the init stages more explicitly
	 */
	replicate: () => Replicator;
	/**
	 * Perform initial query for each of the views as the initial query also builds the index. After that, the update us quite cheap.
	 *
	 * This should be ran after the initial replication to build local views with the data received from the replication.
	 */
	buildIndexes: () => Promise<void>;
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
	stream: (ctx: debug.DebugCtx, isbns: string[]) => Observable<(BookEntry | undefined)[]>;
}

export interface NewDatabase {
	(db: PouchDB.Database): DatabaseInterface;
}
// #endregion db
