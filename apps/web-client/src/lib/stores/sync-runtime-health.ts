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
	lastHandshakeAt: number | null;
	lastAckAt: number | null;
	recentErrors: SyncRuntimeErrorEntry[];
};

const initialState: SyncRuntimeHealthState = {
	lastStatusAt: null,
	lastHandshakeAt: null,
	lastAckAt: null,
	recentErrors: []
};

export const syncRuntimeHealth = writable<SyncRuntimeHealthState>(initialState);

export const syncHealthTick = readable(Date.now(), (set) => {
	const interval = setInterval(() => set(Date.now()), 15_000);
	return () => clearInterval(interval);
});

export function recordSyncStatus(payload: MsgSyncStatus["payload"]) {
	const now = Date.now();
	syncRuntimeHealth.update((state) => {
		const next: SyncRuntimeHealthState = {
			...state,
			lastStatusAt: now
		};

		if (payload.ok) {
			next.lastHandshakeAt = now;
			if (payload.ackDbVersion != null) {
				next.lastAckAt = now;
			}
			if (browser) {
				try {
					localStorage.setItem(SHARED_RUNTIME_HEALTH_KEY, JSON.stringify({ lastStatusAt: now, lastAckAt: next.lastAckAt }));
				} catch {
					// ignore storage failures
				}
			}
			return next;
		}

		const reason = payload.reason || "unknown";
		next.recentErrors = [{ at: now, reason, message: payload.message }, ...state.recentErrors].slice(0, SYNC_ERRORS_HISTORY_LIMIT);
		if (browser) {
			try {
				localStorage.setItem(SHARED_RUNTIME_HEALTH_KEY, JSON.stringify({ lastStatusAt: now, lastAckAt: state.lastAckAt }));
			} catch {
				// ignore storage failures
			}
		}
		return next;
	});
}

export function recordSyncAck() {
	const now = Date.now();
	syncRuntimeHealth.update((state) => {
		if (browser) {
			try {
				localStorage.setItem(SHARED_RUNTIME_HEALTH_KEY, JSON.stringify({ lastStatusAt: state.lastStatusAt, lastAckAt: now }));
			} catch {
				// ignore storage failures
			}
		}
		return { ...state, lastAckAt: now };
	});
}

export function resetSyncRuntimeHealth() {
	syncRuntimeHealth.set(initialState);
}

const storageGuardKey = "__libroccoSyncRuntimeHealthStorageListener";

if (browser && !(globalThis as Record<string, unknown>)[storageGuardKey]) {
	(globalThis as Record<string, unknown>)[storageGuardKey] = true;
	try {
		const raw = localStorage.getItem(SHARED_RUNTIME_HEALTH_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as { lastStatusAt?: number | null; lastAckAt?: number | null };
			syncRuntimeHealth.update((state) => ({
				...state,
				lastStatusAt: typeof parsed.lastStatusAt === "number" ? parsed.lastStatusAt : state.lastStatusAt,
				lastAckAt: typeof parsed.lastAckAt === "number" ? parsed.lastAckAt : state.lastAckAt
			}));
		}
	} catch {
		// ignore malformed storage payloads
	}

	window.addEventListener("storage", (event) => {
		if (event.key !== SHARED_RUNTIME_HEALTH_KEY || !event.newValue) return;
		try {
			const parsed = JSON.parse(event.newValue) as { lastStatusAt?: number | null; lastAckAt?: number | null };
			syncRuntimeHealth.update((state) => ({
				...state,
				lastStatusAt: typeof parsed.lastStatusAt === "number" ? Math.max(state.lastStatusAt ?? 0, parsed.lastStatusAt) : state.lastStatusAt,
				lastAckAt: typeof parsed.lastAckAt === "number" ? Math.max(state.lastAckAt ?? 0, parsed.lastAckAt) : state.lastAckAt
			}));
		} catch {
			// ignore malformed storage payloads
		}
	});
}
