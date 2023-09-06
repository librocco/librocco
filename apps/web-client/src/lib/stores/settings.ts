import { persisted } from "svelte-local-storage-store";

import { LOCAL_STORAGE_COUCH_CONFIG } from "$lib/constants";
import { getDB } from "$lib/db";

import { createReplicationStore, type ReplicationConfig } from "./replication";

/**
 * Provides a light wrapper around replicationStore start() and cancel() to cooridinate
 * - db setup on client side only
 * - persisted remote config / connection
 */
export const createRemoteDbStore = () => {
	const persistedRemoteConfigStore = persisted<ReplicationConfig>(LOCAL_STORAGE_COUCH_CONFIG, null);
	const replicationStore = createReplicationStore();

	const createHandler = (opts: ReplicationConfig) => {
		const db = getDB();

		if (!db) {
			throw Error("Failed to instantiate replication handler: local db is undefined");
		}

		const { url, ...config } = opts;

		replicationStore.start(db, url, config);
		persistedRemoteConfigStore.set(opts);
	};

	const destroyHandler = () => {
		replicationStore.cancel();
		persistedRemoteConfigStore.set(null);
	};

	const { config, status, progress, hasActiveHandler } = replicationStore;

	return {
		replicator: {
			config,
			status,
			progress,
			hasActiveHandler
		},
		persisted: persistedRemoteConfigStore,
		createHandler,
		destroyHandler
	};
};
