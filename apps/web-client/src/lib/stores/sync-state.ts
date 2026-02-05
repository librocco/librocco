import { derived, type Readable } from "svelte/store";

import { syncConnectivityMonitor } from "$lib/stores";

import { pendingChangesCount, lastAckTimestamp } from "./sync-pending";
import { syncCompatibility, type SyncIncompatibilityReason } from "./sync-compatibility";
import { writable } from "svelte/store";

export type SyncState =
	| { status: "disconnected"; pending: number; label: string; cause?: string; lastAckAt?: number | null; ageSeconds?: number | null }
	| { status: "connecting"; pending: number; label: string; cause?: string; lastAckAt?: number | null; ageSeconds?: number | null }
	| { status: "synced"; pending: number; label: string; cause?: string; lastAckAt?: number | null; ageSeconds?: number | null }
	| { status: "syncing"; pending: number; label: string; cause?: string; lastAckAt?: number | null; ageSeconds?: number | null }
	| { status: "stuck"; pending: number; label: string; cause?: string; lastAckAt?: number | null; ageSeconds?: number | null }
	| {
			status: "incompatible";
			pending: number;
			label: string;
			cause?: string;
			lastAckAt?: number | null;
			ageSeconds?: number | null;
			reason: SyncIncompatibilityReason;
			message?: string;
	  };

const STATUS_LABEL: Record<SyncState["status"], string> = {
	disconnected: "Disconnected",
	connecting: "Syncing…",
	synced: "Synced",
	syncing: "Syncing…",
	stuck: "Stuck",
	incompatible: "Incompatible"
} as const;

const mapStuckReason = (reason: string | null) => {
	if (reason === "rapid_closes") return "Rapid reconnects";
	if (reason === "timeout") return "Connection timeout";
	return undefined;
};

export const syncStateTestOverride = writable<SyncState | null>(null);

export function __forceSyncStateForTests(state: SyncState | null) {
	syncStateTestOverride.set(state);
}

export function buildSyncStateForTests(
	status: SyncState["status"],
	pending: number,
	opts: { cause?: string; lastAckAt?: number | null; ageSeconds?: number | null; reason?: SyncIncompatibilityReason; message?: string } = {}
): SyncState {
	const base = {
		status,
		pending,
		label: STATUS_LABEL[status],
		cause: opts.cause,
		lastAckAt: opts.lastAckAt ?? null,
		ageSeconds: opts.ageSeconds ?? (opts.lastAckAt ? Math.max(0, Math.floor((Date.now() - opts.lastAckAt) / 1000)) : null)
	};

	if (status === "incompatible") {
		return { ...base, reason: opts.reason ?? "handshake_failed", message: opts.message };
	}
	return base as SyncState;
}

export const createSyncState = (syncActive: Readable<boolean>) =>
	derived(
		[
			syncActive,
			syncConnectivityMonitor.connected,
			syncConnectivityMonitor.stuck,
			syncConnectivityMonitor.diagnostics,
			pendingChangesCount,
			lastAckTimestamp,
			syncCompatibility,
			syncStateTestOverride
		],
		([active, connected, stuck, diagnostics, pending, lastAckAt, compatibility, override]) => {
			if (override) return override;

			const online = typeof navigator === "undefined" ? true : navigator.onLine;
			const ageSeconds = lastAckAt ? Math.max(0, Math.floor((Date.now() - lastAckAt) / 1000)) : null;

			const base = (status: SyncState["status"], cause?: string) => ({
				status,
				pending,
				label: STATUS_LABEL[status],
				cause,
				lastAckAt,
				ageSeconds
			});

			if (!active) return base("disconnected", online ? undefined : "Offline");
			if (compatibility.status === "incompatible") {
				return { ...base("incompatible", compatibility.message), reason: compatibility.reason, message: compatibility.message };
			}
			if (stuck) return base("stuck", mapStuckReason(diagnostics.reason));
			if (!connected) return base("connecting", online ? undefined : "Offline");
			if (
				compatibility.status === "checking" ||
				compatibility.status === "unknown" ||
				(compatibility.status === "compatible" && !compatibility.verified)
			) {
				return base("connecting");
			}
			if (pending > 0) return base("syncing");

			return base("synced");
		}
	);
