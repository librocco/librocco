import { derived, writable } from "svelte/store";
import { persisted } from "svelte-local-storage-store";

import { LOCAL_STORAGE_COUCH_CONFIG } from "$lib/constants";
import { getDB } from "$lib/db";

import { createReplicationStore, type ReplicationConfig, type ReplicationStore } from "./replication";

export const createRemoteDbStore = () => {
	const persistedRemoteConfigStore = persisted<ReplicationConfig>(LOCAL_STORAGE_COUCH_CONFIG, null);
	const replicatorStore = writable<ReplicationStore>(null);

	const subscribe = derived([persistedRemoteConfigStore, replicatorStore], ([persistedRemoteConfig, replicator]) => ({
		replicator,
		persistedRemoteConfig
	})).subscribe;

	const createHandler = (opts: ReplicationConfig) => {
		const db = getDB();

		if (!db) {
			throw Error("Failed to instantiate replication handler: local db is undefined");
		}

		const { url, ...config } = opts;
		const replicator = createReplicationStore(db, url, config);

		replicatorStore.set(replicator);
		persistedRemoteConfigStore.set(opts);
	};

	const destroyHandler = (replicator: ReplicationStore) => {
		replicator.cancel();

		replicatorStore.set(null);
		persistedRemoteConfigStore.set(null);
	};

	return {
		subscribe,
		createHandler,
		destroyHandler
	};
};
