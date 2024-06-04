import { LOCAL_STORAGE_SETTINGS } from "$lib/constants";
import { settingsSchema } from "$lib/forms";
import { readableFromStream } from "$lib/utils/streams";
import type { DatabaseInterface } from "@librocco/db";
import { superValidateSync } from "sveltekit-superforms/client";
import { persisted } from "svelte-local-storage-store";
import { checkUrlConnection } from "$lib/db";
import { get } from "svelte/store";
import { BehaviorSubject, catchError, from, map, of, share } from "rxjs";
import { browser } from "$app/environment";

const createDBConnectivityStream = () => {
	const shareSuject = new BehaviorSubject(true);

	return browser
		? from(checkUrlConnection(get(settingsStore).couchUrl)).pipe(
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
export const createExtensionAvailabilityStore = (db: DatabaseInterface) => {
	return readableFromStream({}, db?.plugin("book-fetcher").isAvailableStream, false);
};

/**
 * Creates a store from the stream of the db connectivity.
 */
export const createDBConnectivityStore = () => {
	return readableFromStream({}, createDBConnectivityStream(), false);
};

const { data: defaultSettings } = superValidateSync(settingsSchema);
export const settingsStore = persisted(LOCAL_STORAGE_SETTINGS, defaultSettings);
