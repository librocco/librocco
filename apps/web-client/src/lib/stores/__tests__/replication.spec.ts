import { test, expect, describe, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

import type { BookEntry, InventoryDatabaseInterface } from "@librocco/db";
import { testUtils } from "@librocco/shared";

import { newTestDB } from "$lib/__testUtils__/db";
import { default as bookData } from "$lib/db/data/books";

import { createReplicationStore } from "../replication";

const { waitFor } = testUtils;

const books = Object.values(bookData) as unknown as BookEntry[];
const bookIds = books.map(({ isbn }) => isbn);

// Let TS know we're extending TestContext
declare module "vitest" {
	export interface TestContext {
		sourceDb?: InventoryDatabaseInterface;
		remoteDb?: InventoryDatabaseInterface;
	}
}

beforeEach(async (ctx) => {
	const sourceDb = await newTestDB();
	const remoteDb = await newTestDB();

	// Populate source with books
	sourceDb.books().upsert(books);

	ctx.sourceDb = sourceDb;
	ctx.remoteDb = remoteDb;
});

afterEach(async (ctx) => {
	await ctx.sourceDb._pouch.destroy();

	// When we have already closed the remote to simulate an error, this opreation will throw
	if (ctx.remoteDb._pouch) {
		try {
			await ctx.remoteDb._pouch.destroy();
			// eslint-disable-next-line no-empty
		} catch (err) {}
	}
});

describe("Replicate (to/from) remote, when `live == false`", () => {
	test("should replicate data one-way & when uninterrupted should communicate status as: INIT -> ACTIVE:REPLICATIN -> ACTIVE:INDEXING -> COMPLETED", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;
		const booksInterface = remoteDb.books();

		const replicationStore = createReplicationStore();

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "to" });

		await replication.promise;

		const expectedData = await booksInterface.get(bookIds);
		const expectedStatusFlow = ["INIT", "ACTIVE:REPLICATING", "ACTIVE:INDEXING", "COMPLETED"];

		expect(expectedData[0]).not.toBe(undefined);
		expect(statusFlow).toEqual(expectedStatusFlow);

		unsubscribe();
	});

	// Note: Testing for intermediate -> ACTIVE is problematic as we have to wait and check for
	// an indeterminate number of docs to be replicated, and this introduces flakiness
	test("when cancelled should communicate status as: INIT -> FAILED:CANCEL", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "to" });

		// Explicitly cancel replication
		replicationStore.cancel();

		await replication;

		const errorInfo = get(replicationStore.status).info;

		const expectedStatusFlow = ["INIT", "FAILED:CANCEL"];
		const exepctedErrorInfo = "operation cancelled by user";

		expect(statusFlow).toEqual(expectedStatusFlow);
		expect(errorInfo).toEqual(exepctedErrorInfo);

		unsubscribe();
	});

	// Note: not checking -> ACTIVE also applies here
	test("when something goes wrong should communicate status as: INIT -> FAILED:ERROR, and set error info", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "to" });
		// Invoke an error by closing remote Db
		remoteDb._pouch.close();

		await replication.promise;

		const expectedStatusFlow = ["INIT", "FAILED:ERROR"];
		// internal pouch error info
		const exepctedErrorInfo = "database is closed";

		const errorInfo = get(replicationStore.status).info;

		expect(statusFlow).toEqual(expectedStatusFlow);
		expect(errorInfo).toEqual(exepctedErrorInfo);

		unsubscribe();
	});

	test("should track progress", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();
		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "to" });

		await replication.promise;

		const progress = get(replicationStore.progress);

		// manual count of docs in dummy data from "$lib/db/data/books"
		expect(progress.docsRead).toBe(23);
		// It seems with the in-memory adapters pouch adapters, pending does not exist, which means we can't calculate progress => -1
		expect(progress.progress).toBe(-1);
	});
});

describe("Replicate (to/from) remote, when `live == true`", () => {
	test("should communicate idle 'completion' & resumed activity as: INIT -> ACTIVE:REPLICATING -> ACTIVE:REPLICATING  PAUSED:IDLE -> ACTIVE:REPLICATING...", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();
		replicationStore.start(sourceDb, remoteDb._pouch, { live: true, retry: false, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ state }) => statusFlow.push(state));

		// Replication should be idle after initial sourceDb data is replicated to remote
		await waitFor(() => {
			const expectedStatusFlow = ["INIT", "ACTIVE:REPLICATING", "ACTIVE:INDEXING", "PAUSED:IDLE"];
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		// Then we add more books to sourceDb...
		sourceDb.books().upsert(books);

		// ... and expect replication to resume
		await waitFor(() => {
			const expectedStatusFlow = [
				"INIT",
				"ACTIVE:REPLICATING",
				"ACTIVE:INDEXING",
				"PAUSED:IDLE",
				"ACTIVE:REPLICATING",
				"ACTIVE:INDEXING",
				"PAUSED:IDLE"
			];

			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		unsubscribe();
	});

	test("and `retry = false`, should communicate idle 'error'", async (ctx) => {
		const { sourceDb } = ctx;

		// A remote that is currently 'offline' - our replicator will try to connect and fail...
		const errorRemote = "http://admin:admin@127.0.0.1:5000/dev";

		const replicationStore = createReplicationStore();
		replicationStore.start(sourceDb, errorRemote, { live: true, retry: false, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		const expectedStatusFlow = ["INIT", "PAUSED:ERROR"];

		await waitFor(() => {
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		const errorInfo = get(replicationStore.status).info;

		expect(errorInfo).not.toEqual("");

		replicationStore.cancel();
		unsubscribe();
	});

	test("and `retry = true`, should communicate idle 'error'", async (ctx) => {
		const { sourceDb } = ctx;

		// A remote that is currently 'offline' - our replicator will try to connect and fail...
		const errorRemote = "http://admin:admin@127.0.0.1:5000/dev";

		const replicationStore = createReplicationStore();
		replicationStore.start(sourceDb, errorRemote, { live: true, retry: true, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ state }) => statusFlow.push(state));

		const expectedStatusFlow = ["INIT", "PAUSED:ERROR"];

		await waitFor(() => {
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		const errorInfo = get(replicationStore.status).info;

		expect(errorInfo).toEqual("fetch failed");

		replicationStore.cancel();
		unsubscribe();
	});
});

describe("Sync remote, when `live == false`", () => {
	test("should replicate data & when uninterrupted should communicate status as: INIT -> ACTIVE:REPLICATING -> ACTIVE:INDEXING -> COMPLETED", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;
		const booksInterface = remoteDb.books();

		const replicationStore = createReplicationStore();
		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "sync" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		await replication.promise;

		const expectedData = await booksInterface.get(bookIds);
		const expectedStatusFlow = ["INIT", "ACTIVE:REPLICATING", "ACTIVE:INDEXING", "COMPLETED"];

		expect(expectedData[0]).not.toBe(undefined);
		expect(statusFlow).toEqual(expectedStatusFlow);

		unsubscribe();
	});

	test("when cancelled should communicate status as: INIT -> FAILED:CANCEL", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();
		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "sync" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		// Explicitly cancel replication
		replicationStore.cancel();
		await replication.promise;

		const errorInfo = get(replicationStore.status).info;

		const expectedStatusFlow = ["INIT", "FAILED:CANCEL"];
		const exepctedErrorInfo = "operation cancelled by user";

		expect(statusFlow).toEqual(expectedStatusFlow);
		expect(errorInfo).toEqual(exepctedErrorInfo);

		unsubscribe();
	});

	// Note: not checking -> ACTIVE also applies here
	test("when something goes wrong should communicate status as: INIT -> FAILED:ERROR, and set error info", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();
		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "sync" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		// Invoke an error by closing remote Db
		remoteDb._pouch.close();

		await replication.promise;

		const expectedStatusFlow = ["INIT", "FAILED:ERROR"];
		// internal pouch error info
		const exepctedErrorInfo = "database is closed";

		const errorInfo = get(replicationStore.status).info;

		expect(statusFlow).toEqual(expectedStatusFlow);
		expect(errorInfo).toEqual(exepctedErrorInfo);

		unsubscribe();
	});

	test("should track progress", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();
		const replication = replicationStore.start(sourceDb, remoteDb._pouch, { live: false, retry: false, direction: "sync" });

		await replication.promise;

		const progress = get(replicationStore.progress);

		// manual count of docs in dummy data from "$lib/db/data/books"
		expect(progress.docsRead).toBe(23);
		// It seems with the in-memory adapters pouch adapters, pending does not exist, which means we can't calculate progress => -1
		expect(progress.progress).toBe(-1);
	});
});

describe("Sync remote, when `live == true`", () => {
	test("should communicate idle 'completion' & resumed activity as: INIT -> ACTIVE -> PAUSED:IDLE -> ACTIVE", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore();
		replicationStore.start(sourceDb, remoteDb._pouch, { live: true, retry: false, direction: "sync" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		// Replication should be idle after initial sourceDb data is replicated to remote
		await waitFor(() => {
			const expectedStatusFlow = ["INIT", "ACTIVE:REPLICATING", "ACTIVE:INDEXING", "PAUSED:IDLE"];
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		// Then we add more books to sourceDb...
		sourceDb.books().upsert(books);

		// ... and expect replication to resume
		await waitFor(() => {
			const expectedStatusFlow = [
				"INIT",
				"ACTIVE:REPLICATING",
				"ACTIVE:INDEXING",
				"PAUSED:IDLE",
				"ACTIVE:REPLICATING",
				"ACTIVE:INDEXING",
				"PAUSED:IDLE"
			];

			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		unsubscribe();
	});

	test("and `retry = false`, should communicate idle 'error'", async (ctx) => {
		const { sourceDb } = ctx;

		// A remote that is currently 'offline' - our replicator will try to connect and fail...
		const errorRemote = "http://admin:admin@127.0.0.1:5000/dev";

		const replicationStore = createReplicationStore();
		replicationStore.start(sourceDb, errorRemote, { live: true, retry: false, direction: "sync" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		// For some reason this is set twice... maybe once per side? I couldn't figure out why, but there's no harm in it I guess
		const expectedStatusFlow = ["INIT", "PAUSED:ERROR"];

		await waitFor(() => {
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		const errorInfo = get(replicationStore.status).info;

		expect(errorInfo).toEqual("fetch failed");

		replicationStore.cancel();
		unsubscribe();
	});

	test("and `retry = true`, should communicate idle 'error'", async (ctx) => {
		const { sourceDb } = ctx;

		// A remote that is currently 'offline' - our replicator will try to connect and fail...
		const errorRemote = "http://admin:admin@127.0.0.1:5000/dev";

		const replicationStore = createReplicationStore();
		replicationStore.start(sourceDb, errorRemote, { live: true, retry: true, direction: "sync" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe((status) => status && statusFlow.push(status?.state));

		// For some reason this is set twice...: I have a feeling its because it retries immediately
		const expectedStatusFlow = ["INIT", "PAUSED", "PAUSED"];

		await waitFor(() => {
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		const errorInfo = get(replicationStore.status).info;

		// Custom error message, see paused handler of `start_sync_live` handler for details
		expect(errorInfo).toEqual("Sync status cannot be determined. Try refreshing the page");

		replicationStore.cancel();
		unsubscribe();
	});
});
