import { persisted } from "svelte-local-storage-store";
import { of } from "rxjs";
import { defaults } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { type Writable, type Readable, writable } from "svelte/store";
import { browser } from "$app/environment";

import type { PluginsInterface } from "$lib/plugins";

import { readableFromStream } from "$lib/utils/streams";

import WorkerInterface from "$lib/workers/WorkerInterface";

import { LOCAL_STORAGE_APP_SETTINGS, LOCAL_STORAGE_SETTINGS } from "$lib/constants";
import { deviceSettingsSchema } from "$lib/forms/schemas";

const autoPrintLabelsInner = persisted(LOCAL_STORAGE_APP_SETTINGS, false);
const toggleAutoprintLabels = () => autoPrintLabelsInner.update((v) => !v);
export const autoPrintLabels = Object.assign(autoPrintLabelsInner, { toggle: toggleAutoprintLabels });

const { data: defaultSettings } = defaults(zod(deviceSettingsSchema));
export const deviceSettingsStore = persisted<typeof defaultSettings>(LOCAL_STORAGE_SETTINGS, defaultSettings);

const createDBConnectivityStream = () => {
	// TODO: this is updated in a different PR, remove when merged
	return of(false);
};

/**
 * Creates a store from the stream of the db connectivity.
 */
export const createDBConnectivityStore = () => {
	return readableFromStream({}, createDBConnectivityStream(), false);
};

/**
 * Creates a store from the availability stream of the book data extension plugin.
 * This is a function, rather than the store as the store (subscription) needs to be created after the initial load
 * (in browser environment) as the db won't be available before that
 */
export const createExtensionAvailabilityStore = (plugins: PluginsInterface) => {
	return readableFromStream({}, plugins.get("book-fetcher").isAvailableStream, false);
};

export type SyncStuckDiagnostics = {
	reason: "rapid_closes" | null;
	rapidCloseCount: number;
	openCount: number;
	closeCount: number;
	lastOpenTime: number | null;
	lastCloseTime: number | null;
	disconnectedSince: number | null;
	detectedAt: number | null;
};

type SyncConnectivityMonitor = {
	connected: Writable<boolean>;
	stuck: Writable<boolean>;
	diagnostics: Writable<SyncStuckDiagnostics>;
	unsubscribe: Writable<() => void>;
};
const _syncConnectivityMonitor: SyncConnectivityMonitor = {
	connected: writable(false),
	stuck: writable(false),
	diagnostics: writable<SyncStuckDiagnostics>({
		reason: null,
		rapidCloseCount: 0,
		openCount: 0,
		closeCount: 0,
		lastOpenTime: null,
		lastCloseTime: null,
		disconnectedSince: null,
		detectedAt: null
	}),
	unsubscribe: writable<() => void>(() => {})
};

// Sync stuck detection: track rapid reconnect loops.
// For local-first/offline-friendly behavior we do not mark "stuck" on plain disconnect timeout.
const RAPID_CLOSE_THRESHOLD_MS = 2000; // Connection closes less than 2s apart are considered rapid retries
const RAPID_CLOSE_COUNT_TO_STUCK = 3; // Number of rapid closes before marking sync as stuck
const SHARED_SYNC_TRANSPORT_KEY = "librocco-sync-shared-transport";

/** Update sync connectivity monitor event source (worker) */
export function updateSyncConnectivityMonitor(worker?: WorkerInterface) {
	let lastOpenTime: number | null = null;
	let lastCloseTime: number | null = null;
	let rapidCloseCount = 0;
	let openCount = 0;
	let closeCount = 0;
	let disconnectedSince: number | null = null;
	let isConnected = Boolean(worker?.isConnected);
	let sharedConnected = false;
	let sharedLastEventAt: number | null = null;

	const updateConnectedState = () => {
		_syncConnectivityMonitor.connected.set(isConnected || sharedConnected);
	};

	const persistSharedTransport = (connected: boolean) => {
		if (!browser) return;
		try {
			localStorage.setItem(
				SHARED_SYNC_TRANSPORT_KEY,
				JSON.stringify({
					connected,
					at: Date.now()
				})
			);
		} catch {
			// ignore storage failures
		}
	};

	if (browser) {
		try {
			const raw = localStorage.getItem(SHARED_SYNC_TRANSPORT_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as { connected?: boolean; at?: number };
				sharedConnected = Boolean(parsed.connected);
				sharedLastEventAt = typeof parsed.at === "number" ? parsed.at : null;
			}
		} catch {
			sharedConnected = false;
			sharedLastEventAt = null;
		}
	}

	const resetStuckState = () => {
		lastOpenTime = null;
		lastCloseTime = null;
		rapidCloseCount = 0;
		openCount = 0;
		closeCount = 0;
		disconnectedSince = null;
		_syncConnectivityMonitor.stuck.set(false);
		_syncConnectivityMonitor.diagnostics.set({
			reason: null,
			rapidCloseCount: 0,
			openCount: 0,
			closeCount: 0,
			lastOpenTime: null,
			lastCloseTime: null,
			disconnectedSince: null,
			detectedAt: null
		});
	};

	const markStuck = (reason: "rapid_closes") => {
		_syncConnectivityMonitor.stuck.set(true);
		_syncConnectivityMonitor.diagnostics.set({
			reason,
			rapidCloseCount,
			openCount,
			closeCount,
			lastOpenTime,
			lastCloseTime,
			disconnectedSince,
			detectedAt: Date.now()
		});
	};

	const markConnected = () => {
		if (!isConnected) {
			openCount += 1;
		}
		isConnected = true;
		lastOpenTime = Date.now();
		disconnectedSince = null;
		rapidCloseCount = 0;
		updateConnectedState();
		persistSharedTransport(true);
		_syncConnectivityMonitor.stuck.set(false);
		_syncConnectivityMonitor.diagnostics.set({
			reason: null,
			rapidCloseCount,
			openCount,
			closeCount,
			lastOpenTime,
			lastCloseTime,
			disconnectedSince,
			detectedAt: null
		});
	};

	const markDisconnected = (trackRapidClose: boolean) => {
		if (trackRapidClose) {
			closeCount += 1;
		}
		isConnected = false;
		updateConnectedState();
		persistSharedTransport(false);

		const now = Date.now();
		if (disconnectedSince == null) {
			disconnectedSince = now;
		}

		if (trackRapidClose) {
			if (lastCloseTime && now - lastCloseTime < RAPID_CLOSE_THRESHOLD_MS) {
				rapidCloseCount++;
			} else {
				rapidCloseCount = 1;
			}
			lastCloseTime = now;
		}

		if (trackRapidClose && rapidCloseCount >= RAPID_CLOSE_COUNT_TO_STUCK) {
			markStuck("rapid_closes");
		} else {
			// If we are not in a rapid-close stuck condition, ensure stale "stuck"
			// state is cleared so UI reports plain disconnected/reconnecting.
			_syncConnectivityMonitor.stuck.set(false);
			_syncConnectivityMonitor.diagnostics.set({
				reason: null,
				rapidCloseCount,
				openCount,
				closeCount,
				lastOpenTime,
				lastCloseTime,
				disconnectedSince,
				detectedAt: null
			});
		}
	};

	const unsubscribeOpen = worker?.onConnOpen(() => {
		markConnected();
	});

	const unsubscribeClose = worker?.onConnClose(() => {
		markDisconnected(true);
	});

	const unsubscribeSyncStatus = worker?.onSyncStatus?.((payload) => {
		// Fallback signal path: some failure modes can miss explicit conn open/close events.
		// Sync status still provides enough liveness to clear stale timeout states.
		if (payload.ok) {
			markConnected();
			return;
		}
		markDisconnected(false);
	});

	const onStorage = (event: StorageEvent) => {
		if (event.key !== SHARED_SYNC_TRANSPORT_KEY || !event.newValue) return;
		try {
			const parsed = JSON.parse(event.newValue) as { connected?: boolean; at?: number };
			sharedConnected = Boolean(parsed.connected);
			sharedLastEventAt = typeof parsed.at === "number" ? parsed.at : null;
			updateConnectedState();
		} catch {
			// ignore malformed payloads
		}
	};

	if (browser) {
		window.addEventListener("storage", onStorage);
	}

	updateConnectedState();
	resetStuckState();
	if (worker?.isConnected || sharedConnected) {
		lastOpenTime = sharedLastEventAt ?? Date.now();
		disconnectedSince = null;
	} else {
		disconnectedSince = sharedLastEventAt ?? Date.now();
		lastCloseTime = sharedLastEventAt;
	}
	_syncConnectivityMonitor.diagnostics.set({
		reason: null,
		rapidCloseCount,
		openCount,
		closeCount,
		lastOpenTime,
		lastCloseTime,
		disconnectedSince,
		detectedAt: null
	});

	_syncConnectivityMonitor.unsubscribe.update((unsubscribeOld) => {
		unsubscribeOld(); // Unsubscribe previous connection
		// NOTE: even though TS is lax about the unsubscribeOpen/Close, there's a chance they're undefined
		return () => {
			unsubscribeOpen?.();
			unsubscribeClose?.();
			unsubscribeSyncStatus?.();
			if (browser) {
				window.removeEventListener("storage", onStorage);
			}
		};
	});
}

/** Reset the sync stuck state (call after successful nuke and resync) */
export function resetSyncStuckState() {
	_syncConnectivityMonitor.stuck.set(false);
	_syncConnectivityMonitor.diagnostics.set({
		reason: null,
		rapidCloseCount: 0,
		openCount: 0,
		closeCount: 0,
		lastOpenTime: null,
		lastCloseTime: null,
		disconnectedSince: null,
		detectedAt: null
	});
}

// NOTE: the public (exported connectivity monitor is read-only), all updates should be made
// through 'updateSyncConnectivityMonitor'
type SyncConnectivityMonitorPublic = {
	connected: Readable<boolean>;
	stuck: Readable<boolean>;
	diagnostics: Readable<SyncStuckDiagnostics>;
	unsubscribe: Readable<() => void>;
};
/**
 * A read-only stream indicating sync server connection state. The event source (sync worker) is set
 * in root layout.svelte, using `updateSyncConnectivityMonitor`
 */
export const syncConnectivityMonitor: SyncConnectivityMonitorPublic = _syncConnectivityMonitor;
