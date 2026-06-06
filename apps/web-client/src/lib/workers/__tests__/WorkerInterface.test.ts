/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
	isSyncWorkerBridge,
	type SyncProgressPayload,
	type SyncStatusPayload,
	type SyncTransportOptions,
	type SyncWorkerBridge
} from "$lib/db/cr-sqlite/core";
import WorkerInterface from "../WorkerInterface";

type PendingResolver = () => void;

function createBridge(options?: { connected?: boolean; asyncDispose?: boolean; throwOnDispose?: boolean }) {
	const changesReceivedListeners = new Set<(msg: { timestamp: number }) => void>();
	const changesProcessedListeners = new Set<(msg: { timestamp: number }) => void>();
	const progressListeners = new Set<(msg: SyncProgressPayload) => void>();
	const outgoingChangesListeners = new Set<(msg: { maxDbVersion: number; changeCount: number }) => void>();
	const syncStatusListeners = new Set<(msg: SyncStatusPayload) => void>();
	const connOpenListeners = new Set<() => void>();
	const connCloseListeners = new Set<() => void>();
	const pendingResolvers: PendingResolver[] = [];
	let lastSyncStatus: SyncStatusPayload | null = null;

	const addListener = <T>(listeners: Set<(msg: T) => void>, cb: (msg: T) => void) => {
		listeners.add(cb);
		return () => {
			if (options?.throwOnDispose) {
				throw new Error("dispose failed");
			}
			if (!options?.asyncDispose) {
				listeners.delete(cb);
				return;
			}
			return new Promise<void>((resolve) => {
				pendingResolvers.push(() => {
					listeners.delete(cb);
					resolve();
				});
			});
		};
	};

	const addVoidListener = (listeners: Set<() => void>, cb: () => void) => {
		listeners.add(cb);
		return () => {
			if (options?.throwOnDispose) {
				throw new Error("dispose failed");
			}
			if (!options?.asyncDispose) {
				listeners.delete(cb);
				return;
			}
			return new Promise<void>((resolve) => {
				pendingResolvers.push(() => {
					listeners.delete(cb);
					resolve();
				});
			});
		};
	};

	const bridge: SyncWorkerBridge = {
		isConnected: Boolean(options?.connected),
		startSync(dbid: string, transportOpts: SyncTransportOptions) {
			void dbid;
			void transportOpts;
		},
		stopSync(dbid: string) {
			void dbid;
		},
		onChangesReceived(cb) {
			return addListener(changesReceivedListeners, cb);
		},
		onChangesProcessed(cb) {
			return addListener(changesProcessedListeners, cb);
		},
		onProgress(cb) {
			return addListener(progressListeners, cb);
		},
		onOutgoingChanges(cb) {
			return addListener(outgoingChangesListeners, cb);
		},
		onSyncStatus(cb) {
			const dispose = addListener(syncStatusListeners, cb);
			if (lastSyncStatus != null) {
				cb(lastSyncStatus);
			}
			return dispose;
		},
		onConnOpen(cb) {
			return addVoidListener(connOpenListeners, cb);
		},
		onConnClose(cb) {
			return addVoidListener(connCloseListeners, cb);
		}
	};

	return {
		bridge,
		emitChangesReceived(msg: { timestamp: number }) {
			for (const listener of changesReceivedListeners) {
				listener(msg);
			}
		},
		emitSyncStatus(msg: SyncStatusPayload) {
			lastSyncStatus = msg;
			for (const listener of syncStatusListeners) {
				listener(msg);
			}
		},
		resolvePendingDisposals() {
			const resolvers = pendingResolvers.splice(0, pendingResolvers.length);
			for (const resolve of resolvers) {
				resolve();
			}
		}
	};
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("isSyncWorkerBridge", () => {
	it("requires isConnected to be a boolean", () => {
		const { bridge } = createBridge({ connected: true });

		expect(isSyncWorkerBridge(bridge)).toBe(true);
		expect(isSyncWorkerBridge({ ...bridge, isConnected: "yes" as unknown as boolean })).toBe(false);
		expect(isSyncWorkerBridge({ ...bridge, isConnected: undefined as unknown as boolean })).toBe(false);
	});
});

describe("WorkerInterface.bind", () => {
	it("resolves initPromise when binding a non-sync endpoint (null bridge)", async () => {
		const worker = new WorkerInterface();
		worker.bind(null);

		const result = await Promise.race([worker.initPromise.then(() => "resolved"), nextTick().then(() => "pending")]);
		expect(result).toBe("resolved");
	});

	it("waits for pending bridge disposal before wiring listeners for the new endpoint", async () => {
		const oldBridge = createBridge({ asyncDispose: true });
		const newBridge = createBridge();
		const worker = new WorkerInterface(oldBridge.bridge);
		const received: number[] = [];

		worker.onChangesReceived((msg) => {
			received.push(msg.timestamp);
		});

		await nextTick();
		oldBridge.emitChangesReceived({ timestamp: 1 });
		expect(received).toEqual([1]);

		worker.bind(newBridge.bridge);

		// New endpoint should not emit until old async disposers complete.
		newBridge.emitChangesReceived({ timestamp: 2 });
		expect(received).toEqual([1]);

		// Old endpoint can still emit while its async disposer is pending.
		oldBridge.emitChangesReceived({ timestamp: 3 });
		expect(received).toEqual([1, 3]);

		oldBridge.resolvePendingDisposals();
		await nextTick();

		// Once disposal settles, only the new endpoint should emit.
		oldBridge.emitChangesReceived({ timestamp: 4 });
		newBridge.emitChangesReceived({ timestamp: 5 });
		expect(received).toEqual([1, 3, 5]);
	});

	it("chains pending disposals across rapid rebinds before wiring listeners", async () => {
		const firstBridge = createBridge({ asyncDispose: true });
		const secondBridge = createBridge();
		const thirdBridge = createBridge();
		const worker = new WorkerInterface(firstBridge.bridge);
		const received: number[] = [];

		worker.onChangesReceived((msg) => {
			received.push(msg.timestamp);
		});

		await nextTick();
		firstBridge.emitChangesReceived({ timestamp: 1 });
		expect(received).toEqual([1]);

		worker.bind(secondBridge.bridge);
		worker.bind(thirdBridge.bridge);

		// Third endpoint should still wait for first endpoint async disposal.
		thirdBridge.emitChangesReceived({ timestamp: 2 });
		expect(received).toEqual([1]);

		// First endpoint can still emit while disposal is pending.
		firstBridge.emitChangesReceived({ timestamp: 3 });
		expect(received).toEqual([1, 3]);

		firstBridge.resolvePendingDisposals();
		await nextTick();

		firstBridge.emitChangesReceived({ timestamp: 4 });
		thirdBridge.emitChangesReceived({ timestamp: 5 });
		expect(received).toEqual([1, 3, 5]);
	});

	it("logs disposer failures during endpoint rebind cleanup", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const oldBridge = createBridge({ throwOnDispose: true });
			const newBridge = createBridge();
			const worker = new WorkerInterface(oldBridge.bridge);

			await nextTick();
			worker.bind(newBridge.bridge);
			await nextTick();

			expect(warnSpy).toHaveBeenCalledWith("[worker] Failed to dispose sync bridge listener", expect.any(Error));
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("emits connClose when destroying a connected worker", async () => {
		const connectedBridge = createBridge({ connected: true });
		const worker = new WorkerInterface(connectedBridge.bridge);
		const onConnClose = vi.fn();
		worker.onConnClose(onConnClose);

		await nextTick();
		expect(worker.isConnected).toBe(true);

		await worker.destroy();
		expect(onConnClose).toHaveBeenCalledTimes(1);
		expect(worker.isConnected).toBe(false);
	});

	it("reconciles connection state from sync status when connOpen was missed before bind listeners attached", async () => {
		const bridge = createBridge();
		bridge.emitSyncStatus({ ok: true, stage: "ready" });

		const worker = new WorkerInterface(bridge.bridge);
		await nextTick();

		expect(worker.isConnected).toBe(true);
	});

	it("updates connection state from sync status transitions without connOpen/connClose events", async () => {
		const bridge = createBridge();
		const worker = new WorkerInterface(bridge.bridge);
		await nextTick();

		bridge.emitSyncStatus({ ok: true, stage: "ready" });
		expect(worker.isConnected).toBe(true);

		bridge.emitSyncStatus({ ok: false, reason: "remote_unreachable" });
		expect(worker.isConnected).toBe(false);
	});

	it("replays the latest ackDbVersion to late sync-status subscribers even after a later ack-less ok status", async () => {
		const bridge = createBridge();
		const worker = new WorkerInterface(bridge.bridge);
		await nextTick();

		bridge.emitSyncStatus({ ok: true, stage: "apply_ack", ackDbVersion: 6 });
		bridge.emitSyncStatus({ ok: true, stage: "steady" });

		const listener = vi.fn();
		worker.onSyncStatus(listener);

		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				ok: true,
				stage: "steady",
				ackDbVersion: 6
			})
		);
	});
});
