import { type Writable, readable, writable } from "svelte/store";
import { persisted } from "svelte-local-storage-store";

import { browser } from "$app/environment";

import {
	DEFAULT_DB_NAME,
	DEMO_DB_NAME,
	LOCAL_STORAGE_KEY_DBID,
	LOCAL_STORAGE_KEY_SYNC_ACTIVE,
	LOCAL_STORAGE_KEY_SYNC_URL
} from "$lib/constants";

// ---------------------------------- Structs ---------------------------------- //

// // NOTE: we're purposefully casting the demo dbid to writable:
// // - for type simplicity - for most intents and purposes we'll have the selection available (production)
// // - in demo - we're purposefully using readable so that we get a runtime error if some background code is trying to change it
// export const dbid = IS_DEMO ? (readable(DEMO_DB_NAME) as Writable<string>) : persisted("librocco-current-db", "dev");

// const url = persisted("librocco-sync-url", browser ? `${window.location.protocol}//${window.location.host}/sync` : "");

// export const syncActive = persisted("librocco-sync-active", false);

// TEMP: move this to app config
// type SyncConfig = {
// 	dbid?: string;
// 	url?: string;
// };

// /**
//  * Creates a writable settings "store".
//  *
//  * NOTE: This is not really a store, but serves as a wrapper around dbid and sync URL stores (both persisted)
//  * and implements writable store behaviour where:
//  * - the data is derived from those stores
//  * - the updates are propagated to respective stores for each property
//  */
// const newSyncSettingsStore = (): Writable<SyncConfig> => {
// 	const _derived = derived([dbid, url], ([$dbid, $url]) => ({ dbid: $dbid, url: $url }));
// 	const subscribe = _derived.subscribe;

// 	const set = (state: SyncConfig) => {
// 		dbid.set(state.dbid);
// 		url.set(state.url || "");
// 	};

// 	const update = (cb: (state: SyncConfig) => SyncConfig) => set(cb(get(_derived)));

// 	return { subscribe, set, update };
// };

// export const syncConfig = newSyncSettingsStore();

export type IAppConfig = {
	dbid: Writable<string>;
	syncUrl: Writable<string>;
	syncActive: Writable<boolean>;
};

export class AppConfig implements IAppConfig {
	#dbid: Writable<string>;
	get dbid() {
		return this.#dbid;
	}

	#syncUrl: Writable<string>;
	get syncUrl() {
		return this.#syncUrl;
	}

	#syncActive: Writable<boolean>;
	get syncActive() {
		return this.#syncActive;
	}

	private constructor() {}

	/**
	 * Create app.config stores using in-memory (plain `writable`) stores.
	 * This is intended for testing: avoiding the complexity of storing data in local storage.
	 *
	 * NOTE: for production app use `AppConfig.persisted()` to persist the data in local storage between renders
	 */
	static memory() {
		const instance = new AppConfig();

		instance.#dbid = writable("");
		instance.#syncUrl = writable("");
		instance.#syncActive = writable(false);

		return instance;
	}

	/**
	 * Create app.config stores for demo usage:
	 * - dbid - default (read-only) demo DB name
	 * - syncActive - read-only false -- we don't support sync in demo
	 *
	 * IMPORTANT_NOTE: demo stores are read-only (svelte - readable store) cast to `Writable` for type
	 * compliance, but trying to set a value to these stores will throw an error
	 */
	static demo() {
		const instance = new AppConfig();

		instance.#dbid = readable(DEMO_DB_NAME) as Writable<string>;
		instance.#syncUrl = readable("") as Writable<string>;
		instance.#syncActive = readable(false) as Writable<boolean>;

		return instance;
	}

	/**
	 * Create app.config stores for app (dev/production) usage. The stores are presisted to
	 * local storage (using `persisted` stores).
	 */
	static persisted() {
		const instance = new AppConfig();

		instance.#dbid = persisted(LOCAL_STORAGE_KEY_DBID, DEFAULT_DB_NAME);
		const defaultSyncUrl = browser ? `${window.location.protocol}//${window.location.host}/sync` : "";
		instance.#syncUrl = persisted(LOCAL_STORAGE_KEY_SYNC_URL, defaultSyncUrl);
		instance.#syncActive = persisted(LOCAL_STORAGE_KEY_SYNC_ACTIVE, false);

		return instance;
	}
}
