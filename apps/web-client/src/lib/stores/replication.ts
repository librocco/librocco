import { readable, writable, derived, get } from "svelte/store";

import type { DatabaseInterface } from "@librocco/db";

import type PouchDB from "pouchdb";

export const createReplicationStore = (
	local: DatabaseInterface,
	remote: string | PouchDB.Database,
	config: ReplicationOptions = { live: true, retry: true, direction: "sync" }
) => {
	const configStore = readable<ReplicationConfig>({
		...config,
		// This isn't used for the connection, just for reporting something in the UI
		url: typeof remote === "string" ? remote : remote?.name
	});
	const statusStore = writable<{ state: ReplicationState; info: string }>({ state: "INIT", info: "" });

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

	const replicator = initReplicator(local, remote, { ...config, batch_size: 5 });

	// Fires when replication starts or, if `opts.live == true`, when transitioning from "paused"
	replicator.on("active", () => {
		statusStore.set({ state: "ACTIVE", info: "" });
	});

	replicator.on("change", (info) => {
		const change = config.direction === "sync" ? (info as SyncResult).change : (info as ReplicationResult);

		changesStore.set({
			docsWritten: change.docs_written,
			docsRead: change.docs_read,
			// @ts-ignore: `change.pending` seems to exist in some contexts, as is potentially add by the pouch adapter being used
			docsPending: change.pending ?? null
		});
	});

	replicator.on("paused", async (err) => {
		// Non-live replication still 'pauses'. I think this happens between batches
		// We don't need to communicate this in single-shot operations
		if (config.live && config.direction !== "sync") {
			// Err is only passed when `config.retry = true` and pouch is trying to recover
			if (err) {
				statusStore.set({ state: "PAUSED:ERROR", info: (err as Error)?.message });
			} else {
				statusStore.set({ state: "PAUSED:IDLE", info: "" });
			}
		} else if (config.live) {
			// Sync with `opts.live & opts.retry` does not behave as advertised
			// no "err" is passed through when pouch is trying to recover
			// meaning we can't distinguish Paused:Error from Paused:Idle
			// This little trick seems to work in test cases
			const changes = get(changesStore);

			if (!changes.docsWritten) {
				// A custom error message... it may fail for other reasons, but so far I've only seen this behaviour
				// when a 'sync' handler is trying to connect
				statusStore.set({ state: "PAUSED:ERROR", info: "Network error: couldn't connect to remote" });
			} else {
				statusStore.set({ state: "PAUSED:IDLE", info: "" });
			}
		}
	});

	// Fires when finished or explicitly canceled by either end, when `opts.live == false`
	replicator.on("complete", async (info) => {
		if (config.direction !== "sync") {
			const { status } = info as ReplicationResultComplete;

			if (status === "complete") {
				statusStore.set({ state: "COMPLETED", info: "" });
			} else {
				statusStore.set({ state: "FAILED:CANCEL", info: "local db cancelled operation" });
			}
		} else {
			const { pull, push } = info as SyncResultComplete;

			if (pull.status === "complete" && push.status === "complete") {
				statusStore.set({ state: "COMPLETED", info: "" });
			} else if (pull.status === "cancelled" || push.status === "cancelled") {
				// This branch does not appear to fire in tests because the 'complete' event is not emitted
				// when a "sync" handler is cancelled. Leaving just incase I missed something...
				const errorInfo = `${pull.status === "cancelled" ? "remote" : "local"} db cancelled operation"`;

				statusStore.set({ state: "FAILED:CANCEL", info: errorInfo });
			}
		}

		// Just to be sure...
		cancel();
	});

	// Fires on e.g network or server error when `opts.retry == false`
	replicator.on("error", (err) => {
		statusStore.set({ state: "FAILED:ERROR", info: (err as Error)?.message });
		// Just to be sure...
		cancel();
	});

	const cancel = () => {
		replicator.cancel();
		// It's unclear from pouchDB docs/issues whether this is already handled, so we call it just incase
		replicator.removeAllListeners();
	};

	return {
		config: configStore,
		status: statusStore,
		progress: progressStore,
		cancel,
		/**
		 * A promise that will resolve when replication is "done".
		 * This will only happen when in situations where `opts.live == false`
		 */
		done: async () => {
			try {
				await replicator;
			} catch (err) {
				return err;
			}
		}
	};
};

export type ReplicationStore = ReturnType<typeof createReplicationStore>;

export type ReplicationConfig = ReplicationOptions & { url: string };

export type ReplicationState = "INIT" | "ACTIVE" | "COMPLETED" | "FAILED:CANCEL" | "FAILED:ERROR" | "PAUSED:IDLE" | "PAUSED:ERROR";

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
	{},
	SyncResult | ReplicationResult,
	SyncResultComplete | ReplicationResultComplete
>;

type SyncResult = PouchDB.Replication.SyncResult<{}>;
type SyncResultComplete = PouchDB.Replication.SyncResultComplete<{}>;
type ReplicationResult = PouchDB.Replication.ReplicationResult<{}>;
type ReplicationResultComplete = PouchDB.Replication.ReplicationResultComplete<{}>;

const initReplicator = (local: DatabaseInterface, remote: string | PouchDB.Database, config: ReplicationOptions): Replicator => {
	const { direction, ...opts } = config;

	// TODO: update db interface, temp tapping directly into _pouch for ease
	return direction === "sync" ? local._pouch.sync(remote, opts) : local._pouch.replicate[direction](remote, opts);
};
