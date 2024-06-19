/* eslint-disable @typescript-eslint/ban-types */
import { Observable } from "rxjs";
import { BookEntry } from "./misc";

// #region plugins
export type LibroccoPlugin<T extends {}> = {
	register: (instance: T) => LibroccoPlugin<T>;
} & T;

export type BookFetchResultEntry = Partial<BookEntry> | undefined;

export interface BookFetchResult {
	first(): Promise<BookFetchResultEntry>;
	stream(): Observable<BookFetchResultEntry>;
	all(): Promise<BookFetchResultEntry[]>;
}

export interface BookFetcherPlugin {
	// Name is used to differentiate between different implementations satisfying the same interface
	__name: string;
	fetchBookData(isbns: string): BookFetchResult;
	isAvailableStream: Observable<boolean>;
}

export interface PluginInterfaceLookup {
	"book-fetcher": BookFetcherPlugin;
}
// #endregion plugins
