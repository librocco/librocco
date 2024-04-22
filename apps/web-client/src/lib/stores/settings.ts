import { persisted } from "svelte-local-storage-store";

import { LOCAL_STORAGE_COUCH_CONFIG } from "$lib/constants";

/**
 * Provides a light wrapper around replicationStore start() and cancel() to cooridinate
 * - db setup on client side only
 * - persisted remote config / connection
 */
export const createRemoteDbStore = () => {
	const persistedRemoteConfigStore = persisted(LOCAL_STORAGE_COUCH_CONFIG, null);

	return {
		persisted: persistedRemoteConfigStore
	};
};
