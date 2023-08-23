import { writable, derived, get } from "svelte/store";

import type { DatabaseInterface } from "@librocco/db";

import type PouchDB from "pouchdb";

/**
 * Replication store factory
 */
export const createReplicationStore = () => {
	const replicationStores = createReplicationStores();

	const { configStore: config, statusStore: status, progressStore: progress, replicatorStore: replicator } = replicationStores;

	const start = (
		local: DatabaseInterface,
		remote: string | PouchDB.Database,
		config: ReplicationOptions = { live: true, retry: true, direction: "sync" }
	) => {
		const replicationHandlers = createReplicationHandlers(local, replicationStores);

		replicationStores.statusStore.set({ state: "INIT", info: "" });
		replicationStores.configStore.set({
			...config,
			// This isn't used for the connection, just for reporting something in the UI
			url: typeof remote === "string" ? remote : remote?.name
		});

		let replication: { replicator: Replicator; promise: Promise<void> };

		if (!config.live) {
			const oneOffHandler = config.direction !== "sync" ? replicationHandlers.start_replicate : replicationHandlers.start_sync;

			replication = oneOffHandler(local, remote, config);
		} else {
			const liveHandler = config.direction !== "sync" ? replicationHandlers.start_replicate_live : replicationHandlers.start_sync_live;

			replication = liveHandler(local, remote, config);
		}

		replicator.set(replication.replicator);

		return replication;
	};

	const cancel = () => {
		const replicationHandler = get(replicator);

		if (replicationHandler) {
			replicationHandler.cancel();
			replicationHandler.removeAllListeners();
			replicator.set(null);
		}
	};

	return {
		config,
		status,
		progress,
		hasActiveHandler: derived(replicator, (replicatorStore) => (replicatorStore ? true : false)),
		start,
		cancel
	};
};

/**
 * Sets up various stores used by handlers to report replication status, progress, config etc
 */
const createReplicationStores = () => {
	const replicatorStore = writable<Replicator>();
	const configStore = writable<ReplicationConfig>();
	const statusStore = writable<{ state: ReplicationState; info: string }>();

	const changesStore = writable<ReplicationInfo>({ docsWritten: 0, docsRead: 0, docsPending: 0 });
	const progressStore = derived(changesStore, (info) => {
		const { docsWritten, docsPending } = info;

		// It doesn't seem to matter whether we check docsWritten or docsRead
		// in either direction ("to" | "from") or "sync": they report the same number
		const total = docsWritten + docsPending;
		// we can't garauntee that docsPending is present => we return -1 when we can't calculate progress
		const progress = docsPending ? Math.floor((100 * docsWritten) / total) / 100 : -1;

		return {
			...info,
			progress
		};
	});

	return {
		configStore,
		replicatorStore,
		statusStore,
		changesStore,
		progressStore
	};
};

/**
 * Sets up handlers for various pouch replication methods
 * mapping events or promise success|failure to replication store states
 */
const createReplicationHandlers = (db: DatabaseInterface, stores: ReturnType<typeof createReplicationStores>) => {
	const { statusStore, changesStore } = stores;

	const handleError = (replicator, err) => {
		statusStore.set({ state: "FAILED:ERROR", info: (err as Error)?.message });
		// Just to be sure...
		replicator.cancel();
		replicator.removeAllListeners();
	};
	const handleActive = () => statusStore.set({ state: "ACTIVE:REPLICATING", info: "" });
	const handleChange = (change: ReplicationResult) => {
		changesStore.set({
			docsWritten: change.docs_written,
			docsRead: change.docs_read,
			// @ts-expect-error `change.pending` seems to exist in some contexts. It is potentially add by the pouch adapter being used
			docsPending: change?.pending ?? null
		});
	};
	const handleIndexing = async (live = false) => {
		statusStore.set({ state: "ACTIVE:INDEXING", info: "" });

		const doneStatus = live ? "PAUSED:IDLE" : "COMPLETED";

		await db
			.buildIndexes()
			.then(() => statusStore.set({ state: doneStatus, info: "" }))
			// could also throw here and it would be caught in promise chain inside replicationHandler...
			.catch(() => statusStore.set({ state: "FAILED:ERROR", info: "could not build indexes" }));
	};

	/**
	 * Replication handler for pouch.replicate.to|from (one-off)
	 */
	const start_replicate = (local: DatabaseInterface, remote: string | PouchDB.Database, config: ReplicationOptions) => {
		const replicator = local._pouch.replicate[config.direction as "to" | "from"](remote, config);

		replicator.on("active", handleActive);
		replicator.on("change", (info) => handleChange(info));

		// TODO: res in then() handler should also contain info about why... was it completed or cancelled?
		const promise = replicator
			.then(({ status }) => {
				if (status === "complete") {
					// if this threw it would be caught in catch below
					return handleIndexing();
				} else {
					statusStore.set({ state: "FAILED:CANCEL", info: "operation cancelled by user" });
				}
				replicator.removeAllListeners();
			})
			.catch((err) => handleError(replicator, err));

		return {
			replicator,
			promise
		};
	};

	/**
	 * Replication handler for pouch.sync (one-off)
	 */
	const start_sync = (local: DatabaseInterface, remote: string | PouchDB.Database, config: ReplicationOptions) => {
		const replicator = local._pouch.sync(remote, config);

		replicator.on("active", handleActive);
		replicator.on("change", ({ change }) => handleChange(change));

		const promise = replicator
			.then(({ pull, push }) => {
				if (pull.status === "complete" && push.status === "complete") {
					// if this threw it would be caught in catch below
					return handleIndexing();
				} else {
					statusStore.set({ state: "FAILED:CANCEL", info: "operation cancelled by user" });
				}
				replicator.removeAllListeners();
			})
			.catch((err) => handleError(replicator, err));

		return {
			replicator,
			promise
		};
	};

	/**
	 * Replication handler for pouch.replicate.to|from (livee)
	 */
	const start_replicate_live = (local: DatabaseInterface, remote: string | PouchDB.Database, config: ReplicationOptions) => {
		const replicator = local._pouch.replicate[config.direction as "to" | "from"](remote, config);

		replicator.on("active", handleActive);
		replicator.on("change", (info) => handleChange(info));

		// will only fire if live and retry === false
		replicator.on("error", (err) => {
			statusStore.set({ state: "PAUSED:ERROR", info: (err as Error)?.message });
			replicator.removeAllListeners();
		});
		replicator.on("paused", async (err) => {
			if (err) {
				statusStore.set({ state: "PAUSED:ERROR", info: (err as Error)?.message });
			} else {
				await handleIndexing(true);
			}
		});

		return {
			replicator,
			promise: Promise.resolve()
		};
	};

	/**
	 * Replication handler for pouch.sync (live)
	 */
	const start_sync_live = (local: DatabaseInterface, remote: string | PouchDB.Database, config: ReplicationOptions) => {
		const replicator = local._pouch.sync(remote, config);

		replicator.on("active", handleActive);
		replicator.on("change", ({ change }) => handleChange(change));

		// will only fire if live and retry === false
		replicator.on("error", (err) => {
			statusStore.set({ state: "PAUSED:ERROR", info: (err as Error)?.message });
			replicator.removeAllListeners();
		});
		replicator.on("paused", async () => {
			// Sync with live & retry === true does not behave as advertised
			// no "err" is passed through when pouch is trying to recover
			// meaning we can't distinguish Paused:Error from Paused:Idle
			// This little trick seems to work
			const changes = get(changesStore);

			if (!changes.docsWritten) {
				// A custom error message... it may fail for other reasons, but so far I've only seen this behaviour
				// when a 'sync' handler is trying to connect
				statusStore.set({ state: "PAUSED:ERROR", info: "Network error: couldn't connect to remote" });
			} else {
				await handleIndexing(true);
			}
		});

		return {
			replicator,
			promise: Promise.resolve()
		};
	};

	return {
		start_replicate,
		start_replicate_live,
		start_sync,
		start_sync_live
	};
};

export type ReplicationConfig = ReplicationOptions & { url: string };

export type ReplicationState =
	| "INIT"
	| "ACTIVE:REPLICATING"
	| "ACTIVE:INDEXING"
	| "COMPLETED"
	| "FAILED:CANCEL"
	| "FAILED:ERROR"
	| "PAUSED:IDLE"
	| "PAUSED:ERROR";

type ReplicationOptions = PouchDB.Replication.ReplicateOptions & {
	direction: "to" | "from" | "sync";
	live: boolean;
	retry: boolean;
};

type ReplicationInfo = {
	docsWritten: number;
	docsRead: number;
	docsPending: number;
};

/**
 * "Sync" handlers have a slightly different signature than "to" | "from" handlers because of the variable `info` passed to "change" & "complete" events
 * All three methods return an instance of a ReplicationEventEmitter, which we want to work with => this type gives us that single interface
 * The second & third generics define the "change" and "compelete" event `info` - and tell us it can be of either type "SyncResult" or "ReplicationResult"
 * which leaves it up to us to check which one we are working with in the event handlers defined in `createReplicationStore`
 */
type Replicator = PouchDB.Replication.ReplicationEventEmitter<
	Record<string, never>,
	SyncResult | ReplicationResult,
	SyncResultComplete | ReplicationResultComplete
> &
	Promise<SyncResultComplete | ReplicationResultComplete>;

type SyncResult = PouchDB.Replication.SyncResult<Record<string, never>>;
type SyncResultComplete = PouchDB.Replication.SyncResultComplete<Record<string, never>>;
type ReplicationResult = PouchDB.Replication.ReplicationResult<Record<string, never>>;
type ReplicationResultComplete = PouchDB.Replication.ReplicationResultComplete<Record<string, never>>;
