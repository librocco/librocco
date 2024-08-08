/* eslint-disable @typescript-eslint/ban-types */
import type { Search } from "js-search";
import { Observable } from "rxjs";

import { debug } from "@librocco/shared";

import type { LibroccoPlugin, PluginInterfaceLookup } from "./plugins";

/**
 * Used to make one or more properties on the object optional.
 */
export type PickPartial<R extends Record<string, any>, K extends keyof R> = Omit<R, K> & Partial<Pick<R, K>>;
// #endregion misc

export type SearchIndex = Search;

export type TimestampedDoc<T extends Record<string, any>> = {
	createdAt: string | null;
	updatedAt: string | null;
} & T;

// #region books
//  'isbn': '9788808451880',
//  'title': 'Matematica.azzurro con TUTOR 5',
//  'price': '30.7',
//  'year': '2021'}
//  'author': '', // ------------ 'authors'
//  'publisher': 'Zanichelli',
//  'edited_by': '', // ------------ 'editedBy'
//  'out_of_print': 'false', // ------------ 'outOfPrint'
//  'category': '500', 'basement'

export interface BookEntry {
	isbn: string;
	title: string;
	price: number;
	year?: string;
	authors?: string;
	publisher?: string;
	editedBy?: string;
	outOfPrint?: boolean;
	category?: string;

	/** Book data that has 'updatedAt' field set had already been filled with data */
	updatedAt?: string;
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
	plugin<K extends keyof PluginInterfaceLookup>(type: K): LibroccoPlugin<PluginInterfaceLookup[K]>;
	/**
	 * Destroy the current db instance and clear the data
	 */
	destroy(): Promise<void>;
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
