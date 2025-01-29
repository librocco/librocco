import { get } from "svelte/store";
import { BehaviorSubject, catchError, from, map, of, share } from "rxjs";
import { browser } from "$app/environment";

import { checkUrlConnection } from "$lib/db";
import type { PluginsInterface } from "$lib/plugins";

import { settingsStore } from "./app";

import { readableFromStream } from "$lib/utils/streams";

const createDBConnectivityStream = () => {
	const shareSuject = new BehaviorSubject(true);
	const { couchUrl: url } = get(settingsStore);

	return browser && url
		? from(checkUrlConnection(url)).pipe(
				map((response: Response) => response.ok),
				catchError(() => of(false)),
				share({ connector: () => shareSuject, resetOnComplete: false, resetOnError: false, resetOnRefCountZero: false })
			)
		: of(false);
};

/**
 * Creates a store from the availability stream of the book data extension plugin.
 * This is a function, rather than the store as the store (subscription) needs to be created after the initial load
 * (in browser environment) as the db won't be available before that
 */
export const createExtensionAvailabilityStore = (plugins: PluginsInterface) => {
	return readableFromStream({}, plugins.get("book-fetcher").isAvailableStream, false);
};

/**
 * Creates a store from the stream of the db connectivity.
 */
export const createDBConnectivityStore = () => {
	return readableFromStream({}, createDBConnectivityStream(), false);
};
