import { writable } from "svelte/store";

import type { DatabaseInterface } from "@librocco/db";

import { getDB } from "$lib/db";

export const createReplicationStore =
	(local = getDB()) =>
	(remote: string | PouchDB.Database, config: ReplicationOptions = { live: true, retry: true, direction: "sync" }) => {
		// TODO: does config need to be in a store?
		const configStore = writable<ReplicationOptions | null>(config);
		const statusStore = writable({ status: ReplicationStatus.Inactive, info: "" });

		const replicator = initReplicator(local, remote, config);

		replicator.on("active", () => {
			// Fires when replication starts
			// or, if `opts.live == true`, when transitioning from "paused"
			statusStore.set({ status: ReplicationStatus.Active, info: "" });

			// TODO: I'd like to check previous status...
			// to distinguish between "started" and "restarted"... or is this not needed?
		});

		replicator.on("complete", (info) => {
			// if live == false => fires when complete, or if cancel() was called
			if (config.live === false) {
				statusStore.set({ status: ReplicationStatus.Complete, info: "" });
			}

			// if live == true => fires on cancel()
			// {}

			cancel();
		});

		const cancel = () => {
			replicator.cancel();
			replicator.removeAllListeners();

			configStore.set(null);
		};

		return {
			config: configStore,
			status: statusStore,
			cancel,
			done: async () => {
				await replicator;
			}
		};
	};

export enum ReplicationStatus {
	Inactive = "INACTIVE",
	Active = "ACTIVE",
	Complete = "COMPLETE"
}

type ReplicationOptions = PouchDB.Replication.ReplicateOptions & { direction: "to" | "from" | "sync" };

/**
 * "Sync" handlers have a slightly different signature than "to" | "from" handlers because of the variable `info` passed to "change" & "complete" events
 * All three methods return an instance of a ReplicationEventEmitter, which we want to work with => this type gives us that single interaction point
 * The second & third generics define the "change" and "compelete" event `info` - and tell us it can be of either type "SyncResult" or "ReplicationResult"
 * which leaves it up to us to check which one we are working with in the event handlers defined in `createReplicationStore`
 */
type Replicator = PouchDB.Replication.ReplicationEventEmitter<
	{ change: { pending?: string } },
	PouchDB.Replication.SyncResult<{}> | PouchDB.Replication.ReplicationResult<{}>,
	PouchDB.Replication.SyncResultComplete<{}> | PouchDB.Replication.ReplicationResultComplete<{}>
>;

const initReplicator = (local: DatabaseInterface, remote: string | PouchDB.Database, config: ReplicationOptions): Replicator => {
	const { direction, ...opts } = config;

	// TODO: update db interface, temp tapping directly into _pouch for ease
	return direction === "sync" ? local._pouch.sync(remote, opts) : local._pouch.replicate[direction](remote, opts);
};
