/* eslint-disable @typescript-eslint/ban-types */
import type { BookData } from "./types";
import { BehaviorSubject, Observable, from } from "rxjs";

// #region types
export type LibroccoPlugin<T extends {}> = {
	/**
	 * Registers a new implementation of the plugin. It's idempotent in case of the same implementation being registered multiple times (will register only once).
	 */
	register: (instance: T) => LibroccoPlugin<T>;

	/**
	 * Reset the plugin instance - essentially creating a new instance of the plugin.
	 */
	reset: () => void;
} & T;

export type BookFetchResultEntry = BookData | undefined;

export interface BookFetchResult {
	first(): Promise<BookFetchResultEntry>;
	stream(): Observable<BookFetchResultEntry>;
	all(): Promise<BookFetchResultEntry[]>;
}

export interface BookFetchOptions {
	/**
	 * Instructs the plugin (controller) to retry the ISBN even if fetch already attempted.
	 * _Note: this is different than ongoing fetches - the fetch won't be attempted again if it's already in progress._
	 */
	retryIfAlreadyAttempted?: boolean;
}

export interface BookFetcherPlugin {
	// Name is used to differentiate between different implementations satisfying the same interface
	__name: string;
	fetchBookData(isbns: string, opts?: BookFetchOptions): BookFetchResult;
	isAvailableStream: Observable<boolean>;
}

export interface PluginInterfaceLookup {
	"book-fetcher": BookFetcherPlugin;
}

// #region utils

export const fetchBookDataFromSingleSource =
	(constructRequest: (isbn: string) => Promise<BookFetchResultEntry>) =>
	(isbn: string): BookFetchResult => {
		const request = constructRequest(isbn);
		const first = () => request;
		const stream = () => from(request);
		const all = () => Promise.all([request]);
		return { first, stream, all };
	};

export const createSingleSourceBookFetcher = (
	name: string,
	constructRequest: (isbn: string) => Promise<BookFetchResultEntry>,
	availabilityStream: Observable<boolean> | boolean
): BookFetcherPlugin => ({
	__name: name,
	fetchBookData: fetchBookDataFromSingleSource(constructRequest),
	isAvailableStream: typeof availabilityStream === "boolean" ? new BehaviorSubject(availabilityStream) : availabilityStream
});
