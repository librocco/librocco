import { derived, type Readable } from "svelte/store";

import { syncConnectivityMonitor } from "$lib/stores";

import { pendingChangesCount, pendingChangesSince } from "./sync-pending";
import { syncCompatibility, type SyncIncompatibilityReason } from "./sync-compatibility";
import { syncHealthTick, syncRuntimeHealth } from "./sync-runtime-health";
import { localDbHealth } from "./local-db-health";

const ACK_STALE_MS = 45_000;
const PENDING_STALE_MS = 120_000;

export type SyncState =
	| { status: "disconnected"; pending: number }
	| { status: "connecting"; pending: number; reason: "reconnecting" | "checking_compatibility" }
	| { status: "synced"; pending: number }
	| { status: "syncing"; pending: number }
	| {
			status: "warning";
			pending: number;
			reason: "ack_stale" | "pending_stale";
			message: string;
	  }
	| {
			status: "warning";
			pending: number;
			reason: "local_db_warning";
			message: string;
	  }
	| {
			status: "stuck";
			pending: number;
			reason: "rapid_closes" | "timeout";
			message: string;
	  }
	| { status: "incompatible"; pending: number; reason: SyncIncompatibilityReason; message?: string };

export const createSyncState = (syncActive: Readable<boolean>) =>
	derived(
		[
			syncActive,
			syncConnectivityMonitor.connected,
			syncConnectivityMonitor.stuck,
			syncConnectivityMonitor.diagnostics,
			pendingChangesCount,
			pendingChangesSince,
			syncCompatibility,
			syncRuntimeHealth,
			syncHealthTick,
			localDbHealth
		],
		([active, connected, stuck, diagnostics, pending, pendingSince, compatibility, runtime, _tick, dbHealth]) => {
			const now = Date.now();

			if (!active) return { status: "disconnected", pending };
			if (compatibility.status === "incompatible") {
				return { status: "incompatible", pending, reason: compatibility.reason, message: compatibility.message };
			}
			if (stuck) {
				const reason = diagnostics.reason === "rapid_closes" ? "rapid_closes" : "timeout";
				const message =
					reason === "rapid_closes"
						? `Sync reconnect loop detected (${diagnostics.rapidCloseCount} rapid disconnects).`
						: "No sync connection established for over 10 seconds.";
				return { status: "stuck", pending, reason, message };
			}
			if (!connected) return { status: "connecting", pending, reason: "reconnecting" };
			if (
				compatibility.status === "checking" ||
				compatibility.status === "unknown" ||
				(compatibility.status === "compatible" && !compatibility.verified)
			) {
				return { status: "connecting", pending, reason: "checking_compatibility" };
			}

			if (dbHealth.status === "warning" || dbHealth.status === "error") {
				return {
					status: "warning",
					pending,
					reason: "local_db_warning",
					message: dbHealth.message || "Local DB health checks reported potential issues."
				};
			}

			if (pending > 0 && pendingSince && now - pendingSince > PENDING_STALE_MS) {
				return {
					status: "warning",
					pending,
					reason: "pending_stale",
					message: "Pending changes have not drained for a long time."
				};
			}

			if (pending > 0 && (!runtime.lastAckAt || now - runtime.lastAckAt > ACK_STALE_MS)) {
				return {
					status: "warning",
					pending,
					reason: "ack_stale",
					message: "No recent server ack observed while pending changes exist."
				};
			}

			if (pending > 0) return { status: "syncing", pending };

			return { status: "synced", pending: 0 };
		}
	);
