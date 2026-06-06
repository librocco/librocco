import { readable, writable } from "svelte/store";
import { browser } from "$app/environment";

import type { MsgSyncStatus } from "$lib/workers/types";

const SYNC_ERRORS_HISTORY_LIMIT = 5;
const SHARED_RUNTIME_HEALTH_KEY = "librocco-sync-runtime-health";

export type SyncRuntimeErrorEntry = {
	at: number;
	reason: string;
	message?: string;
};

export type SyncRuntimeHealthState = {
	lastStatusAt: number | null;
	connectedAt: number | null;
	lastHandshakeAt: number | null;
	lastAckAt: number | null;
	recentErrors: SyncRuntimeErrorEntry[];
};

const initialState: SyncRuntimeHealthState = {
	lastStatusAt: null,
	connectedAt: null,
	lastHandshakeAt: null,
	lastAckAt: null,
	recentErrors: []
};

export const syncRuntimeHealth = writable<SyncRuntimeHealthState>(initialState);

export const syncHealthTick = readable(Date.now(), (set) => {
	const interval = setInterval(() => set(Date.now()), 15_000);
	return () => clearInterval(interval);
});

type PersistedRuntimeHealth = {
	lastStatusAt?: number | null;
	connectedAt?: number | null;
	lastHandshakeAt?: number | null;
	lastAckAt?: number | null;
};

const maxTimestamp = (a: number | null | undefined, b: number | null | undefined): number | null => {
	if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
	if (typeof a === "number") return a;
	if (typeof b === "number") return b;
	return null;
};

const readStoredRuntimeHealth = (): PersistedRuntimeHealth => {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(SHARED_RUNTIME_HEALTH_KEY);
		if (!raw) return {};
		return JSON.parse(raw) as PersistedRuntimeHealth;
	} catch {
		return {};
	}
};

const mergeRuntimeHealth = (base: SyncRuntimeHealthState, incoming: PersistedRuntimeHealth): SyncRuntimeHealthState => ({
	...base,
	lastStatusAt: maxTimestamp(base.lastStatusAt, incoming.lastStatusAt),
	connectedAt: maxTimestamp(base.connectedAt, incoming.connectedAt),
	lastHandshakeAt: maxTimestamp(base.lastHandshakeAt, incoming.lastHandshakeAt),
	lastAckAt: maxTimestamp(base.lastAckAt, incoming.lastAckAt)
});

const persistRuntimeHealth = (candidate: PersistedRuntimeHealth) => {
	if (!browser) return;
	try {
		const current = readStoredRuntimeHealth();
		const merged = {
			lastStatusAt: maxTimestamp(current.lastStatusAt, candidate.lastStatusAt),
			connectedAt: maxTimestamp(current.connectedAt, candidate.connectedAt),
			lastHandshakeAt: maxTimestamp(current.lastHandshakeAt, candidate.lastHandshakeAt),
			lastAckAt: maxTimestamp(current.lastAckAt, candidate.lastAckAt)
		};
		localStorage.setItem(SHARED_RUNTIME_HEALTH_KEY, JSON.stringify(merged));
	} catch {
		// ignore storage failures
	}
};

export function recordSyncStatus(payload: MsgSyncStatus["payload"]) {
	const now = Date.now();
	syncRuntimeHealth.update((state) => {
		const next: SyncRuntimeHealthState = {
			...state,
			lastStatusAt: now
		};

		if (payload.ok) {
			if (next.connectedAt == null) {
				next.connectedAt = now;
			}
			next.lastHandshakeAt = now;
			if (payload.ackDbVersion != null) {
				next.lastAckAt = now;
			}
			persistRuntimeHealth({
				lastStatusAt: now,
				connectedAt: next.connectedAt,
				lastHandshakeAt: now,
				lastAckAt: next.lastAckAt
			});
			return next;
		}

		next.connectedAt = null;
		const reason = payload.reason || "unknown";
		next.recentErrors = [{ at: now, reason, message: payload.message }, ...state.recentErrors].slice(0, SYNC_ERRORS_HISTORY_LIMIT);
		persistRuntimeHealth({
			lastStatusAt: now,
			lastHandshakeAt: state.lastHandshakeAt,
			lastAckAt: state.lastAckAt
		});
		return next;
	});
}

export function recordSyncAck() {
	const now = Date.now();
	syncRuntimeHealth.update((state) => {
		persistRuntimeHealth({
			lastStatusAt: state.lastStatusAt,
			connectedAt: state.connectedAt,
			lastHandshakeAt: state.lastHandshakeAt,
			lastAckAt: now
		});
		return { ...state, lastAckAt: now };
	});
}

export function resetSyncRuntimeHealth() {
	syncRuntimeHealth.set(initialState);
	if (browser) {
		try {
			localStorage.removeItem(SHARED_RUNTIME_HEALTH_KEY);
		} catch {
			// ignore storage failures
		}
	}
}

export function clearSyncRecentErrors() {
	syncRuntimeHealth.update((state) => ({
		...state,
		recentErrors: []
	}));
}

const storageGuardKey = "__libroccoSyncRuntimeHealthStorageListener";

if (browser && !(globalThis as Record<string, unknown>)[storageGuardKey]) {
	(globalThis as Record<string, unknown>)[storageGuardKey] = true;
	syncRuntimeHealth.update((state) => mergeRuntimeHealth(state, readStoredRuntimeHealth()));

	window.addEventListener("storage", (event) => {
		if (event.key !== SHARED_RUNTIME_HEALTH_KEY) return;
		if (event.newValue == null) {
			syncRuntimeHealth.set(initialState);
			return;
		}
		try {
			const parsed = JSON.parse(event.newValue) as PersistedRuntimeHealth;
			syncRuntimeHealth.update((state) => mergeRuntimeHealth(state, parsed));
		} catch {
			// ignore malformed storage payloads
		}
	});
}
