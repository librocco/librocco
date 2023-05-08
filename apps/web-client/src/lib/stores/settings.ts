import { derived } from "svelte/store";

import { persisted } from "svelte-local-storage-store";

import { LOCAL_STORAGE_COUCH_CONFIG } from "$lib/constants";

import type { RemoteCouchConfig } from "$lib/types/settings";

const remoteCouchConfigStorage = persisted<RemoteCouchConfig>(LOCAL_STORAGE_COUCH_CONFIG, {});

const derivedCouchConfig = derived(remoteCouchConfigStorage, ($remoteCouchConfigStorage) => {
	const { couchUrl = "" } = $remoteCouchConfigStorage;

	const dbName = couchUrl.substring(couchUrl.lastIndexOf("/") + 1, couchUrl.length);

	return {
		couchUrl,
		dbName
	};
});

export const remoteCouchConfigStore = {
	subscribe: derivedCouchConfig.subscribe,
	set: remoteCouchConfigStorage.set,
	update: remoteCouchConfigStorage.update
};
