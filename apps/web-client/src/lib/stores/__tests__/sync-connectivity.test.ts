/** @vitest-environment node */
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncConnectivityMonitor, updateSyncConnectivityMonitor } from "$lib/stores/app";

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
		for (const cb of this.#openListeners) {
			cb();
		}
	}

	emitClose() {
		this.isConnected = false;
		for (const cb of this.#closeListeners) {
			cb();
		}
	}
}

describe("updateSyncConnectivityMonitor", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		updateSyncConnectivityMonitor(undefined);
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		updateSyncConnectivityMonitor(undefined);
	});

	it("marks sync as stuck after repeated rapid closes without successful opens", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);

		worker.emitClose();
		vi.advanceTimersByTime(200);
		worker.emitClose();
		vi.advanceTimersByTime(200);
		worker.emitClose();

		expect(get(syncConnectivityMonitor.stuck)).toBe(true);
		expect(get(syncConnectivityMonitor.connected)).toBe(false);
		expect(get(syncConnectivityMonitor.diagnostics).reason).toBe("rapid_closes");
	});

	it("marks sync as stuck after timeout while continuously disconnected", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);

		vi.advanceTimersByTime(10_000);

		expect(get(syncConnectivityMonitor.stuck)).toBe(true);
		expect(get(syncConnectivityMonitor.connected)).toBe(false);
		expect(get(syncConnectivityMonitor.diagnostics).reason).toBe("timeout");
	});

	it("marks sync as stuck after prolonged disconnect despite periodic close events", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);

		vi.advanceTimersByTime(3_000);
		worker.emitClose();
		vi.advanceTimersByTime(3_000);
		worker.emitClose();
		vi.advanceTimersByTime(3_000);
		worker.emitClose();
		vi.advanceTimersByTime(900);
		expect(get(syncConnectivityMonitor.stuck)).toBe(false);

		vi.advanceTimersByTime(200);
		expect(get(syncConnectivityMonitor.stuck)).toBe(true);
		expect(get(syncConnectivityMonitor.connected)).toBe(false);
		expect(get(syncConnectivityMonitor.diagnostics).reason).toBe("timeout");
	});

	it("clears stuck state when connection opens again", () => {
		const worker = new FakeWorker();
		updateSyncConnectivityMonitor(worker as any);

		vi.advanceTimersByTime(10_000);
		expect(get(syncConnectivityMonitor.stuck)).toBe(true);

		worker.emitOpen();

		expect(get(syncConnectivityMonitor.stuck)).toBe(false);
		expect(get(syncConnectivityMonitor.connected)).toBe(true);
		expect(get(syncConnectivityMonitor.diagnostics).reason).toBe(null);
	});
});
