/* eslint-disable @typescript-eslint/ban-types */
import { Observable } from "rxjs";

import type { BookData } from "@librocco/shared";

// #region plugins
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
// #endregion plugins
