import { get, writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateSyncConnectivityMonitor } from "$lib/stores/app";

import { createSyncState } from "../sync-state";
import { syncCompatibility } from "../sync-compatibility";
import { localDbHealth, resetLocalDbHealth } from "../local-db-health";
import { pendingChangesCount, pendingChangesSince, resetPendingTracker } from "../sync-pending";
import { resetSyncRuntimeHealth, syncHealthTick, syncRuntimeHealth } from "../sync-runtime-health";

class FakeWorker {
	isConnected = false;

	#openListeners = new Set<() => void>();
	#closeListeners = new Set<() => void>();

	onConnOpen(cb: () => void) {
		this.#openListeners.add(cb);
		return () => this.#openListeners.delete(cb);
	}

	onConnClose(cb: () => void) {
		this.#closeListeners.add(cb);
		return () => this.#closeListeners.delete(cb);
	}

	emitOpen() {
		this.isConnected = true;
		for (const cb of this.#openListeners) cb();
	}

	emitClose() {
		this.isConnected = false;
		for (const cb of this.#closeListeners) cb();
	}
}

const markCompatible = (verified = true) => {
	syncCompatibility.set({
		status: "compatible",
		remoteSiteId: "site-1",
		remoteSchemaVersion: "1",
		verified
	});
};

describe("createSyncState", () => {
	const clearSharedTransportKeys = () => {
		localStorage.removeItem("librocco-sync-shared-transport");
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (key?.startsWith("librocco-sync-shared-transport:")) {
				localStorage.removeItem(key);
			}
		}
	};

	beforeEach(() => {
		vi.useFakeTimers();

		updateSyncConnectivityMonitor(undefined);
		resetPendingTracker();
		resetSyncRuntimeHealth();
		resetLocalDbHealth();
		clearSharedTransportKeys();
		syncCompatibility.set({ status: "unknown" });
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();

		updateSyncConnectivityMonitor(undefined);
		resetPendingTracker();
		resetSyncRuntimeHealth();
		resetLocalDbHealth();
		clearSharedTransportKeys();
		syncCompatibility.set({ status: "unknown" });
	});

	it("returns disconnected when sync is disabled", () => {
		const syncActive = writable(false);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({ status: "disconnected", pending: 0 });
	});

	it("returns connecting/reconnecting when sync is enabled but transport is disconnected", () => {
		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({ status: "connecting", pending: 0, reason: "reconnecting" });
	});

	it("returns connecting/checking_compatibility when connected but compatibility is not verified", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitOpen();

		markCompatible(false);
		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({ status: "connecting", pending: 0, reason: "checking_compatibility" });
	});

	it("returns warning/local_db_warning when local DB health has warnings", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitOpen();
		markCompatible(true);
		localDbHealth.set({
			status: "warning",
			lastQuickCheckAt: Date.now(),
			lastIntegrityCheckAt: null,
			suspected: true,
			message: "quick_check failed"
		});

		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({
			status: "warning",
			pending: 0,
			reason: "local_db_warning",
			message: "quick_check failed"
		});
	});

	it("returns warning/pending_stale when pending changes stay queued too long", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitOpen();
		markCompatible(true);
		const now = get(syncHealthTick);
		localDbHealth.set({ status: "ok", lastQuickCheckAt: now, lastIntegrityCheckAt: null, suspected: false });
		pendingChangesCount.set(2);
		pendingChangesSince.set(now - 121_000);
		syncRuntimeHealth.set({ lastStatusAt: now, connectedAt: now, lastHandshakeAt: now, lastAckAt: now, recentErrors: [] });

		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({
			status: "warning",
			pending: 2,
			reason: "pending_stale",
			message: "Pending changes have not drained for a long time."
		});
	});

	it("returns warning/ack_stale when pending changes have no recent server ack", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitOpen();
		markCompatible(true);
		const now = get(syncHealthTick);
		localDbHealth.set({ status: "ok", lastQuickCheckAt: now, lastIntegrityCheckAt: null, suspected: false });
		pendingChangesCount.set(1);
		pendingChangesSince.set(now - 5_000);
		syncRuntimeHealth.set({ lastStatusAt: now, connectedAt: now - 46_000, lastHandshakeAt: now, lastAckAt: null, recentErrors: [] });

		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({
			status: "warning",
			pending: 1,
			reason: "ack_stale",
			message: "No recent server ack observed while pending changes exist."
		});
	});

	it("returns syncing when connected, compatible and pending without stale conditions", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitOpen();
		markCompatible(true);
		const now = get(syncHealthTick);
		localDbHealth.set({ status: "ok", lastQuickCheckAt: now, lastIntegrityCheckAt: null, suspected: false });
		pendingChangesCount.set(3);
		pendingChangesSince.set(now - 1_000);
		syncRuntimeHealth.set({ lastStatusAt: now, connectedAt: now, lastHandshakeAt: now, lastAckAt: now, recentErrors: [] });

		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({ status: "syncing", pending: 3 });
	});

	it("returns synced when connected, compatible and queue is empty", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitOpen();
		markCompatible(true);
		const now = get(syncHealthTick);
		localDbHealth.set({ status: "ok", lastQuickCheckAt: now, lastIntegrityCheckAt: null, suspected: false });
		pendingChangesCount.set(0);
		pendingChangesSince.set(null);
		syncRuntimeHealth.set({ lastStatusAt: now, connectedAt: now, lastHandshakeAt: now, lastAckAt: now, recentErrors: [] });

		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({ status: "synced", pending: 0 });
	});

	it("prioritizes incompatible over stuck", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitClose();
		vi.advanceTimersByTime(200);
		worker.emitClose();
		vi.advanceTimersByTime(200);
		worker.emitClose();

		syncCompatibility.set({ status: "incompatible", reason: "remote_reset", message: "Remote DB changed identity since last sync" });

		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({
			status: "incompatible",
			pending: 0,
			reason: "remote_reset",
			message: "Remote DB changed identity since last sync"
		});
	});

	it("returns stuck on rapid reconnect loop", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);
		worker.emitClose();
		vi.advanceTimersByTime(200);
		worker.emitClose();
		vi.advanceTimersByTime(200);
		worker.emitClose();
		markCompatible(true);

		const syncActive = writable(true);
		const state = createSyncState(syncActive);
		expect(get(state)).toEqual({
			status: "stuck",
			pending: 0,
			reason: "rapid_closes",
			message: "Sync reconnect loop detected (3 rapid disconnects)."
		});
	});
});
