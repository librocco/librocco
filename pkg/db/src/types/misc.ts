/* eslint-disable @typescript-eslint/ban-types */
import type { Search } from "js-search";
import { Observable } from "rxjs";

import { debug } from "@librocco/shared";

import type { DocType } from "@/enums";

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
	_deleted?: boolean;
} & Doc;

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

export type SearchIndex = Search;
// #endregion misc

// #region books
//  'isbn': '9788808451880',
//  'title': 'Matematica.azzurro con TUTOR 5',
//  'price': '30.7',
//  'year': '2021'}
//  'author': '', // ------------ 'authors'
//  'publisher': 'Zanichelli',
//  'edited_by': '', // ------------ 'editedBy'
//  'out_of_print': 'false', // ------------ 'outOfPrint'

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
	upsert: (bookEntries: Partial<BookEntry>[]) => Promise<void>;
	/**
	 * Stream accepts an array of isbns and streams a same length array of book data or `undefined`.
	 *
	 * _Note: we can guarantee that each streamed value will be an array of the same length as the input array, as well
	 * as the results being in the same order as the input array: a book data at index 'i' will correspond to the isbn at
	 * index 'i' of the request array, if the book data doesn't exist in the db, `undefined` will be found at its place._
	 */
	stream: (ctx: debug.DebugCtx, isbns: string[]) => Observable<(BookEntry | undefined)[]>;
	/**
	 * Steams a list of publishers built from 'publisher' properties of book data already in the db.
	 */
	streamPublishers: (ctx: debug.DebugCtx) => Observable<string[]>;
	/**
	 * Get search index for full-text search, built from relevant books
	 */
	streamSearchIndex: () => Observable<SearchIndex>;
}
// #endregion books

// #region db
export type DatabaseInterface<T = {}> = {
	/** A reference to the pouch db instance the db interface was built around. */
	_pouch: PouchDB.Database;
	/** Update design doc is here more for internal usage and, shouldn't really be called explicitly (call `db.init` instead). */
	updateDesignDoc(doc: DesignDocument): Promise<PouchDB.Core.Response>;
	/**
	 * Init initialises the db:
	 * - creates the default warehouse
	 * - uploads the design docs
	 *
	 * _Note: this has to be called only the first time the db is initialised (unless using live replication), but is
	 * idempotent in nature and it's good to run it each time the app is loaded (+ it's necessary if using live replication)._
	 */
	init: () => Promise<DatabaseInterface<T>>;
	/**
	 * Sets up replication by returning four methods that enable the client to schedule the init stages more explicitly
	 */
	replicate: () => Replicator;
	/**
	 * Creates an instance to interface with a plugin.
	 * The implementation should be such that, if the plugin is unreachable, the methods are a noop.
	 * @param type type of the plugin (essentially a name)
	 */
	plugin<T extends keyof PluginInterfaceLookup>(type: T): LibroccoPlugin<PluginInterfaceLookup[T]>;
	/**
	 * Perform initial query for each of the views as the initial query also builds the index. After that, the update us quite cheap.
	 *
	 * This should be ran after the initial replication to build local views with the data received from the replication.
	 */
	buildIndices: () => Promise<void>;
} & T;
// #endregion db

// #region replication
export interface Replicator {
	/**
	 * To sets up a transient replcation from the local db (to the remote db). It returns the `replication`
	 * object and a `promise` method that resolves when the replication is done and the first value from db is updated.
	 * @param ctx debug context
	 * @param url remote db url
	 */
	to: (url: string | PouchDB.Database, options: PouchDB.Replication.ReplicateOptions) => PouchDB.Replication.Replication<{}>;
	/**
	 * From sets up a transient replication from the remote db (to the local db). It returns the `replication`
	 * object and a `promise` method that resolves when the replication is done and the first value from db is updated.
	 * @param ctx debug context
	 * @param url remote db url
	 */
	from: (url: string | PouchDB.Database, options: PouchDB.Replication.ReplicateOptions) => PouchDB.Replication.Replication<{}>;
	/**
	 * Sync sets up a bidirectional, transient replication between two db instances. It returns the `replication`
	 * object and a `promise` method that resolves when the replication is done and the first value from db is updated.
	 * @param ctx debug context
	 * @param url remote db url
	 */
	sync: (url: string | PouchDB.Database, options: PouchDB.Replication.ReplicateOptions) => PouchDB.Replication.Sync<{}>;
}
// #endregion replication

// #region plugins
export type LibroccoPlugin<T extends {}> = {
	register: (instance: T) => LibroccoPlugin<T>;
} & T;

export interface BookFetcherPlugin {
	fetchBookData(isbns: string[]): Promise<(Partial<BookEntry> | undefined)[]>;
	isAvailableStream: Observable<boolean>;
}

export interface PluginInterfaceLookup {
	"book-fetcher": BookFetcherPlugin;
}
// #endregion plugins
