import { persisted } from "svelte-local-storage-store";
import { of } from "rxjs";
import { defaults } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { type Writable, type Readable, writable } from "svelte/store";

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
	reason: "rapid_closes" | "timeout" | null;
	rapidCloseCount: number;
	lastOpenTime: number | null;
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
		lastOpenTime: null,
		detectedAt: null
	}),
	unsubscribe: writable<() => void>(() => {})
};

// Sync stuck detection: track rapid connection close patterns
const SYNC_STUCK_THRESHOLD_MS = 10000; // Consider stuck after 10 seconds of failed connections
const RAPID_CLOSE_THRESHOLD_MS = 2000; // Connection closes less than 2s apart are considered rapid retries
const RAPID_CLOSE_COUNT_TO_STUCK = 3; // Number of rapid closes before marking sync as stuck

/** Update sync connectivity monitor event source (worker) */
export function updateSyncConnectivityMonitor(worker?: WorkerInterface) {
	let lastOpenTime: number | null = null;
	let lastCloseTime: number | null = null;
	let rapidCloseCount = 0;
	let disconnectedSince: number | null = null;
	let stuckTimeout: ReturnType<typeof setTimeout> | null = null;

	const clearStuckTimeout = () => {
		if (stuckTimeout) {
			clearTimeout(stuckTimeout);
			stuckTimeout = null;
		}
	};

	const armStuckTimeout = () => {
		clearStuckTimeout();
		if (disconnectedSince == null) {
			return;
		}

		const elapsed = Date.now() - disconnectedSince;
		const remaining = Math.max(0, SYNC_STUCK_THRESHOLD_MS - elapsed);
		stuckTimeout = setTimeout(() => {
			if (disconnectedSince != null && !worker?.isConnected) {
				markStuck("timeout");
			}
		}, remaining);
	};

	const resetStuckState = () => {
		lastOpenTime = null;
		lastCloseTime = null;
		rapidCloseCount = 0;
		disconnectedSince = null;
		_syncConnectivityMonitor.stuck.set(false);
		_syncConnectivityMonitor.diagnostics.set({
			reason: null,
			rapidCloseCount: 0,
			lastOpenTime: null,
			detectedAt: null
		});
		clearStuckTimeout();
	};

	const markStuck = (reason: "rapid_closes" | "timeout") => {
		_syncConnectivityMonitor.stuck.set(true);
		_syncConnectivityMonitor.diagnostics.set({
			reason,
			rapidCloseCount,
			lastOpenTime,
			detectedAt: Date.now()
		});
	};

	const unsubscribeOpen = worker?.onConnOpen(() => {
		resetStuckState();
		lastOpenTime = Date.now();
		_syncConnectivityMonitor.connected.set(true);
	});

	const unsubscribeClose = worker?.onConnClose(() => {
		_syncConnectivityMonitor.connected.set(false);

		// Track rapid reconnect loops even when no successful "open" happened.
		const now = Date.now();
		if (disconnectedSince == null) {
			disconnectedSince = now;
		}
		if (lastCloseTime && now - lastCloseTime < RAPID_CLOSE_THRESHOLD_MS) {
			rapidCloseCount++;
		} else {
			rapidCloseCount = 1;
		}
		lastCloseTime = now;

		if (rapidCloseCount >= RAPID_CLOSE_COUNT_TO_STUCK) {
			markStuck("rapid_closes");
		} else {
			armStuckTimeout();
		}

		lastOpenTime = null;
	});

	_syncConnectivityMonitor.connected.set(worker?.isConnected || false);
	resetStuckState();
	if (!worker?.isConnected) {
		disconnectedSince = Date.now();
		armStuckTimeout();
	}

	_syncConnectivityMonitor.unsubscribe.update((unsubscribeOld) => {
		unsubscribeOld(); // Unsubscribe previous connection
		// NOTE: even though TS is lax about the unsubscribeOpen/Close, there's a chance they're undefined
		return () => {
			unsubscribeOpen?.();
			unsubscribeClose?.();
			clearStuckTimeout();
		};
	});
}

/** Reset the sync stuck state (call after successful nuke and resync) */
export function resetSyncStuckState() {
	_syncConnectivityMonitor.stuck.set(false);
	_syncConnectivityMonitor.diagnostics.set({
		reason: null,
		rapidCloseCount: 0,
		lastOpenTime: null,
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
