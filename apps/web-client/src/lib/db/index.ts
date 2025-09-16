import { derived, get as get, readable, type Writable } from "svelte/store";
import { persisted } from "svelte-local-storage-store";
import { browser } from "$app/environment";

import { DEMO_DB_NAME, IS_DEMO } from "$lib/constants";

import type { SyncConfig } from "./sync";
export * from "./sync";

// NOTE: we're purposefully casting the demo dbid to writable:
// - for type simplicity - for most intents and purposes we'll have the selection available (production)
// - in demo - we're purposefully using readable so that we get a runtime error if some background code is trying to change it
export const dbid = IS_DEMO ? (readable(DEMO_DB_NAME) as Writable<string>) : persisted("librocco-current-db", "dev");

const url = persisted("librocco-sync-url", browser ? `${window.location.protocol}//${window.location.host}/sync` : "");

export const syncActive = persisted("librocco-sync-active", false);

/**
 * Creates a writable settings "store".
 *
 * NOTE: This is not really a store, but serves as a wrapper around dbid and sync URL stores (both persisted)
 * and implements writable store behaviour where:
 * - the data is derived from those stores
 * - the updates are propagated to respective stores for each property
 */
const newSyncSettingsStore = (): Writable<SyncConfig> => {
	const _derived = derived([dbid, url], ([$dbid, $url]) => ({ dbid: $dbid, url: $url }));
	const subscribe = _derived.subscribe;

	const set = (state: SyncConfig) => {
		dbid.set(state.dbid);
		url.set(state.url || "");
	};

	const update = (cb: (state: SyncConfig) => SyncConfig) => set(cb(get(_derived)));

	return { subscribe, set, update };
};

export const syncConfig = newSyncSettingsStore();

// TODO; update this
export const checkUrlConnection = async (url: string) => {
	const [credenialsAndUrl, urlEnd] = url.split("@");

	url = urlEnd === undefined ? url : `https://${urlEnd}`;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, credentials] = credenialsAndUrl.split("//");

	const headers = new Headers();
	const encodedCredentials = btoa(credentials);
	headers.append("Authorization", `Basic ${encodedCredentials}`);

	return fetch(url, {
		method: "GET",
		headers: headers,
		credentials: "include"
	});
};
