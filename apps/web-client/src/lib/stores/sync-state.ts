import { derived, type Readable } from "svelte/store";

import { syncConnectivityMonitor } from "$lib/stores";

import { pendingChangesCount } from "./sync-pending";

export type SyncState =
	| { status: "disconnected"; pending: number }
	| { status: "connecting"; pending: number }
	| { status: "synced"; pending: number }
	| { status: "syncing"; pending: number }
	| { status: "stuck"; pending: number };

export const createSyncState = (syncActive: Readable<boolean>) =>
	derived([syncActive, syncConnectivityMonitor.connected, syncConnectivityMonitor.stuck, pendingChangesCount], ([active, connected, stuck, pending]) => {
		if (!active) return { status: "disconnected", pending };
		if (stuck) return { status: "stuck", pending };
		if (!connected) return { status: "connecting", pending };
		if (pending > 0) return { status: "syncing", pending };

		return { status: "synced", pending: 0 };
	});
