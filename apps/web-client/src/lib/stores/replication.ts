import { writable } from "svelte/store";

import type { DatabaseInterface } from "@librocco/db";

import PouchDB from "pouchdb";

import { getDB } from "$lib/db";

export const createReplicationStore =
	(local = getDB()) =>
	(remote: string | PouchDB.Database, config: ReplicationOptions = { live: true, retry: true, direction: "sync" }) => {
		// TODO: does config need to be in a store?
		const configStore = writable<ReplicationOptions | null>(config);
		const stateStore = writable<ReplicationState>("INIT");
		const infoStore = writable<ReplicationInfo>({ error: "" });

		const replicator = initReplicator(local, remote, config);

		// Fires when replication starts or, if `opts.live == true`, when transitioning from "paused"
		replicator.on("active", () => {
			stateStore.set("ACTIVE");
		});

		// Fires when finished or explicitly canceled by either end, when `opts.live == false`
		replicator.on("complete", (info) => {
			if (config.direction !== "sync") {
				const { status } = info as ReplicationResultComplete;

				if (status === "complete") {
					stateStore.set("COMPLETED");
				} else {
					stateStore.set("FAILED:CANCEL");
				}
			} else {
				const { pull, push } = info as SyncResultComplete;

				if (pull.status === "complete" && push.status === "complete") {
					stateStore.set("COMPLETED");
				} else if (pull.status === "cancelled" || push.status === "cancelled") {
					stateStore.set("FAILED:CANCEL");
				}
			}

			cancel();
		});

		// Fires on e.g network or server error when `opts.retry == false`
		replicator.on("error", (err) => {
			stateStore.set("FAILED:ERROR");
			infoStore.update((info) => ({ ...info, error: (err as Error)?.message }));
			cancel();
		});

		const cancel = () => {
			replicator.cancel();
			replicator.removeAllListeners();

			configStore.set(null);
		};

		return {
			config: configStore,
			status: stateStore,
			cancel,
			done: async () => {
				try {
					await replicator;
				} catch (err) {
					return err;
				}
			}
		};
	};

type ReplicationOptions = PouchDB.Replication.ReplicateOptions & { direction: "to" | "from" | "sync" };

type ReplicationState = "INIT" | "ACTIVE" | "COMPLETED" | "FAILED:CANCEL" | "FAILED:ERROR" | "PAUSED:IDLE" | "PAUSED:ERROR";

type ReplicationInfo = {
	error: string;
};

/**
 * "Sync" handlers have a slightly different signature than "to" | "from" handlers because of the variable `info` passed to "change" & "complete" events
 * All three methods return an instance of a ReplicationEventEmitter, which we want to work with => this type gives us that single interface
 * The second & third generics define the "change" and "compelete" event `info` - and tell us it can be of either type "SyncResult" or "ReplicationResult"
 * which leaves it up to us to check which one we are working with in the event handlers defined in `createReplicationStore`
 */
type Replicator = PouchDB.Replication.ReplicationEventEmitter<
	{ change: { pending?: string } },
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
