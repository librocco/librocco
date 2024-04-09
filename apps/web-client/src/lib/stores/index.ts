import { createRemoteDbStore } from "./settings";
import { readableFromStream } from "$lib/utils/streams";
import type { DatabaseInterface } from "@librocco/db";

export const remoteDbStore = createRemoteDbStore();

/**
 * Creates a store from the availability stream of the book data extension plugin.
 * This is a function, rather than the store as the store (subscription) needs to be created after the initial load
 * (in browser environment) as the db won't be available before that
 */
export const createExtensionAvailabilityStore = (db: DatabaseInterface) => {
	return readableFromStream({}, db?.plugin("book-fetcher").isAvailableStream, false);
};
