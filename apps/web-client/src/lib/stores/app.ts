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
	reason: "rapid_closes" | "timeout" | "repeated_disconnects" | null;
	rapidCloseCount: number;
	disconnectCount: number;
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
		disconnectCount: 0,
		lastOpenTime: null,
		detectedAt: null
	}),
	unsubscribe: writable<() => void>(() => {})
};

// Sync stuck detection: track rapid connection close patterns
const SYNC_STUCK_THRESHOLD_MS = 10000; // Consider stuck after 10 seconds of failed connections
const RAPID_CLOSE_THRESHOLD_MS = 2000; // Connection closing within 2s of opening is "rapid"
const DISCONNECT_TRACKING_WINDOW_MS = 120000; // Track disconnects within a 2-minute window
const REPEATED_DISCONNECT_THRESHOLD = 3; // Number of disconnects to trigger "repeated_disconnects"

/** Update sync connectivity monitor event source (worker) */
export function updateSyncConnectivityMonitor(worker?: WorkerInterface) {
	let lastOpenTime: number | null = null;
	let rapidCloseCount = 0;
	let stuckTimeout: ReturnType<typeof setTimeout> | null = null;

	// Track all disconnects within a time window to detect repeated connection failures
	// (even if each connection lasts longer than RAPID_CLOSE_THRESHOLD_MS)
	let disconnectTimestamps: number[] = [];

	const resetStuckState = () => {
		rapidCloseCount = 0;
		disconnectTimestamps = [];
		_syncConnectivityMonitor.stuck.set(false);
		_syncConnectivityMonitor.diagnostics.set({
			reason: null,
			rapidCloseCount: 0,
			disconnectCount: 0,
			lastOpenTime: null,
			detectedAt: null
		});
		if (stuckTimeout) {
			clearTimeout(stuckTimeout);
			stuckTimeout = null;
		}
	};

	const markStuck = (reason: "rapid_closes" | "timeout" | "repeated_disconnects") => {
		_syncConnectivityMonitor.stuck.set(true);
		_syncConnectivityMonitor.diagnostics.set({
			reason,
			rapidCloseCount,
			disconnectCount: disconnectTimestamps.length,
			lastOpenTime,
			detectedAt: Date.now()
		});
	};

	const unsubscribeOpen = worker?.onConnOpen(() => {
		lastOpenTime = Date.now();
		_syncConnectivityMonitor.connected.set(true);

		// Start a timeout - if we don't get stable connection, mark as stuck
		if (stuckTimeout) clearTimeout(stuckTimeout);
		stuckTimeout = setTimeout(() => {
			// If we're still not connected after threshold, mark as stuck
			if (!worker?.isConnected) {
				markStuck("timeout");
			}
		}, SYNC_STUCK_THRESHOLD_MS);
	});

	const unsubscribeClose = worker?.onConnClose(() => {
		_syncConnectivityMonitor.connected.set(false);

		const now = Date.now();

		// Track this disconnect for repeated disconnect detection
		disconnectTimestamps.push(now);
		// Remove old timestamps outside the tracking window
		disconnectTimestamps = disconnectTimestamps.filter((ts) => now - ts < DISCONNECT_TRACKING_WINDOW_MS);

		// Check if this was a rapid close (connection failed quickly)
		if (lastOpenTime && now - lastOpenTime < RAPID_CLOSE_THRESHOLD_MS) {
			rapidCloseCount++;
			// After 3 rapid closes, mark as stuck
			if (rapidCloseCount >= 3) {
				markStuck("rapid_closes");
			}
		}

		// Check for repeated disconnects (even if not rapid)
		// This catches the case where handshake succeeds but connection keeps timing out
		if (disconnectTimestamps.length >= REPEATED_DISCONNECT_THRESHOLD) {
			console.warn(
				`[sync] Detected ${disconnectTimestamps.length} disconnects within ${DISCONNECT_TRACKING_WINDOW_MS / 1000}s - marking as stuck`
			);
			markStuck("repeated_disconnects");
		}

		lastOpenTime = null;
	});

	_syncConnectivityMonitor.connected.set(worker?.isConnected || false);
	resetStuckState();

	_syncConnectivityMonitor.unsubscribe.update((unsubscribeOld) => {
		unsubscribeOld(); // Unsubscribe previous connection
		// NOTE: even though TS is lax about the unsubscribeOpen/Close, there's a chance they're undefined
		return () => {
			unsubscribeOpen?.();
			unsubscribeClose?.();
			if (stuckTimeout) clearTimeout(stuckTimeout);
		};
	});
}

/** Reset the sync stuck state (call after successful nuke and resync) */
export function resetSyncStuckState() {
	_syncConnectivityMonitor.stuck.set(false);
	_syncConnectivityMonitor.diagnostics.set({
		reason: null,
		rapidCloseCount: 0,
		disconnectCount: 0,
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
