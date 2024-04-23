import { LOCAL_STORAGE_SETTINGS } from "$lib/constants";
import { settingsSchema } from "$lib/forms";
import { readableFromStream } from "$lib/utils/streams";
import type { DatabaseInterface } from "@librocco/db";
import { superValidateSync } from "sveltekit-superforms/client";
import { persisted } from "svelte-local-storage-store"


/**
 * Creates a store from the availability stream of the book data extension plugin.
 * This is a function, rather than the store as the store (subscription) needs to be created after the initial load
 * (in browser environment) as the db won't be available before that
 */
export const createExtensionAvailabilityStore = (db: DatabaseInterface) => {
    return readableFromStream({}, db?.plugin("book-fetcher").isAvailableStream, false);
};

const { data: defaultSettings } = superValidateSync(settingsSchema);
export const settingsStore = persisted(LOCAL_STORAGE_SETTINGS, defaultSettings);