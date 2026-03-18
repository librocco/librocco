/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";
import type { App } from "../index";
import type { DBAsync } from "$lib/db/cr-sqlite/core/types";

vi.mock("$lib/db/cr-sqlite/db", () => {
	const db = {
		execA: vi.fn().mockResolvedValue([["ok"]]),
		exec: vi.fn().mockResolvedValue(undefined),
		automigrateTo: vi.fn().mockResolvedValue("ok")
	};

	return {
		getDB: vi.fn().mockResolvedValue(db),
		getSchemaNameAndVersion: vi.fn().mockResolvedValue(["schema", 1]),
		schemaContent: "schema",
		schemaName: "schema",
		schemaVersion: 1
	};
});

vi.mock("@vlcn.io/rx-tbl", () => ({
	default: () => ({
		onPoint: () => () => {},
		onRange: () => () => {},
		onAny: () => () => {}
	})
}));

import { AppDb, AppDbState, getDb, initializeDb } from "../db";
import { ErrDBOpenTransient } from "../errors";
import { getDB } from "$lib/db/cr-sqlite/db";

describe("initializeDb", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.mocked(getDB).mockResolvedValue({
			execA: vi.fn().mockResolvedValue([["ok"]]),
			exec: vi.fn().mockResolvedValue(undefined),
			automigrateTo: vi.fn().mockResolvedValue("ok")
		} as any);
	});

	afterEach(async () => {
		await vi.runOnlyPendingTimersAsync();
		vi.useRealTimers();
	});

	it("initializes when dbid matches but state is Loading", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";

		// Mirrors reset flow: dbid matches, but state is stuck in Loading before init.
		app.db.dbid = dbid;
		app.db.setState(dbid, AppDbState.Loading);

		await initializeDb(app, dbid, "asyncify-idb-batch-atomic");

		// Expect init to run and complete; the current early return prevents this.
		expect(getDB).toHaveBeenCalledOnce();
		expect(get(app.db.state)).toBe(AppDbState.Ready);
	});

	it("wraps transient lock-like open failures as ErrDBOpenTransient", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";
		const lockError = new Error("database is locked");
		vi.mocked(getDB).mockRejectedValue(lockError);

		const initPromise = initializeDb(app, dbid, "asyncify-idb-batch-atomic").catch((err) => err);
		await vi.runAllTimersAsync();

		const err = await initPromise;
		expect(err).toBeInstanceOf(ErrDBOpenTransient);
		expect(get(app.db.state)).toBe(AppDbState.Error);
		expect(app.db.error).toBeInstanceOf(ErrDBOpenTransient);
	});

	it("preserves non-transient open failures", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";
		const permissionError = new Error("permission denied");
		vi.mocked(getDB).mockRejectedValue(permissionError);

		const initPromise = initializeDb(app, dbid, "asyncify-idb-batch-atomic").catch((err) => err);
		await vi.runAllTimersAsync();

		const err = await initPromise;
		expect(err).toBe(permissionError);
		expect(get(app.db.state)).toBe(AppDbState.Error);
		expect(app.db.error).toBe(permissionError);
	});
});

describe("getDb", () => {
	it("throws immediately when DB is in Error state", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";
		const dbError = new Error("init failed");

		app.db.dbid = dbid;
		app.db.setState(dbid, AppDbState.Error, dbError);

		await expect(getDb(app)).rejects.toBe(dbError);
	});

	it("throws when DB transitions to Error while waiting", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";
		const dbError = new Error("failed while loading");

		app.db.dbid = dbid;
		app.db.setState(dbid, AppDbState.Loading);

		const getDbPromise = getDb(app);
		app.db.setState(dbid, AppDbState.Error, dbError);

		await expect(getDbPromise).rejects.toBe(dbError);
	});

	it("returns the DB when state becomes Ready", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";
		const dbMock = {} as unknown as DBAsync;

		app.db.dbid = dbid;
		app.db.setState(dbid, AppDbState.Loading);

		const getDbPromise = getDb(app);
		app.db.setState(dbid, AppDbState.Ready, { db: dbMock, vfs: "asyncify-idb-batch-atomic" });

		await expect(getDbPromise).resolves.toBe(dbMock);
	});

	it("returns the newest DB handle when state flips Ready -> Loading -> Ready", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";
		const firstDbMock = { first: true } as unknown as DBAsync;
		const secondDbMock = { second: true } as unknown as DBAsync;

		app.db.dbid = dbid;
		app.db.setState(dbid, AppDbState.Loading);

		const getDbPromise = getDb(app);

		app.db.setState(dbid, AppDbState.Ready, { db: firstDbMock, vfs: "asyncify-idb-batch-atomic" });
		app.db.setState(dbid, AppDbState.Migrating);
		app.db.setState(dbid, AppDbState.Ready, { db: secondDbMock, vfs: "asyncify-idb-batch-atomic" });

		await expect(getDbPromise).resolves.toBe(secondDbMock);
	});
});
