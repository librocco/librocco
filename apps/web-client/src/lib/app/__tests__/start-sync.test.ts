/** @vitest-environment node */
import { writable } from "svelte/store";
import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/app/db", () => ({
	getDb: vi.fn(),
	getVfs: vi.fn()
}));

vi.mock("$lib/app/utils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/app/utils")>();
	return {
		...actual,
		waitForStore: vi.fn().mockResolvedValue(undefined)
	};
});

vi.mock("$lib/db/cr-sqlite/db", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/db/cr-sqlite/db")>();
	return {
		...actual,
		isEmptyDB: vi.fn()
	};
});

vi.mock("$lib/db/cr-sqlite/core/vfs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/db/cr-sqlite/core/vfs")>();
	return {
		...actual,
		vfsSupportsOPFS: vi.fn()
	};
});

vi.mock("$lib/stores", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/stores")>();
	return {
		...actual,
		updateSyncConnectivityMonitor: vi.fn()
	};
});

vi.mock("$lib/stores/sync-compatibility", () => ({
	checkSyncCompatibility: vi.fn().mockResolvedValue(undefined),
	markCompatibilityChecking: vi.fn()
}));

import { getDb, getVfs } from "$lib/app/db";
import { isEmptyDB } from "$lib/db/cr-sqlite/db";
import { vfsSupportsOPFS } from "$lib/db/cr-sqlite/core/vfs";
import { AppSyncState, startSync } from "../sync";

describe("startSync", () => {
	it("still calls sync.start when sync is already active", async () => {
		vi.mocked(getDb).mockResolvedValue({} as never);
		vi.mocked(getVfs).mockReturnValue({} as never);
		vi.mocked(isEmptyDB).mockResolvedValue(false);
		vi.mocked(vfsSupportsOPFS).mockReturnValue(false);

		const bindDb = vi.fn().mockReturnValue(true);
		const start = vi.fn().mockResolvedValue(undefined);

		const syncCore = {
			active: true,
			bindDb,
			start,
			state: writable(AppSyncState.Idle),
			initialSyncProgressStore: writable({ active: false, nProcessed: 0, nTotal: 0 })
		};
		const app = {
			sync: {
				state: writable(AppSyncState.Idle),
				runExclusive: <T>(cb: (sync: typeof syncCore) => T | Promise<T>) => cb(syncCore)
			}
		};

		await startSync(app as never, "db-2", "https://sync.example");

		expect(bindDb).toHaveBeenCalledOnce();
		expect(start).toHaveBeenCalledWith("db-2", "https://sync.example");
	});
});
