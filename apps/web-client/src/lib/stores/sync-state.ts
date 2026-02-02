import { derived, type Readable } from "svelte/store";

import { syncConnectivityMonitor } from "$lib/stores";

import { pendingChangesCount } from "./sync-pending";
import { syncCompatibility, type SyncIncompatibilityReason } from "./sync-compatibility";

export type SyncState =
	| { status: "disconnected"; pending: number }
	| { status: "connecting"; pending: number }
	| { status: "synced"; pending: number }
	| { status: "syncing"; pending: number }
	| { status: "stuck"; pending: number }
	| { status: "incompatible"; pending: number; reason: SyncIncompatibilityReason; message?: string };

export const createSyncState = (syncActive: Readable<boolean>) =>
	derived(
		[syncActive, syncConnectivityMonitor.connected, syncConnectivityMonitor.stuck, pendingChangesCount, syncCompatibility],
		([active, connected, stuck, pending, compatibility]) => {
			if (!active) return { status: "disconnected", pending };
			if (compatibility.status === "incompatible") {
				return { status: "incompatible", pending, reason: compatibility.reason, message: compatibility.message };
			}
			if (stuck) return { status: "stuck", pending };
			if (!connected) return { status: "connecting", pending };
			if (pending > 0) return { status: "syncing", pending };

			return { status: "synced", pending: 0 };
		}
	);
