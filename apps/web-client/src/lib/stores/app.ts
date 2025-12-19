import { persisted } from "svelte-local-storage-store";
import { of } from "rxjs";
import { defaults } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";

import type { PluginsInterface } from "$lib/plugins";

import { readableFromStream } from "$lib/utils/streams";

import { LOCAL_STORAGE_APP_SETTINGS, LOCAL_STORAGE_SETTINGS } from "$lib/constants";
import { deviceSettingsSchema } from "$lib/forms/schemas";

const autoPrintLabelsInner = persisted(LOCAL_STORAGE_APP_SETTINGS, false);
const toggleAutoprintLabels = () => autoPrintLabelsInner.update((v) => !v);
export const autoPrintLabels = Object.assign(autoPrintLabelsInner, { toggle: toggleAutoprintLabels });

const { data: defaultSettings } = defaults(zod(deviceSettingsSchema));
export const deviceSettingsStore = persisted<typeof defaultSettings>(LOCAL_STORAGE_SETTINGS, defaultSettings);

const createDBConnectivityStream = () => {
	// TODO: this is updated in a different PR, remove when merged
	return of(false);
};

/**
 * Creates a store from the stream of the db connectivity.
 */
export const createDBConnectivityStore = () => {
	return readableFromStream({}, createDBConnectivityStream(), false);
};

/**
 * Creates a store from the availability stream of the book data extension plugin.
 * This is a function, rather than the store as the store (subscription) needs to be created after the initial load
 * (in browser environment) as the db won't be available before that
 */
export const createExtensionAvailabilityStore = (plugins: PluginsInterface) => {
	return readableFromStream({}, plugins.get("book-fetcher").isAvailableStream, false);
};
