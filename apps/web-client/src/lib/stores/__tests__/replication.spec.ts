import { test, expect, describe, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

import type { BookEntry, DatabaseInterface } from "@librocco/db";
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
		sourceDb?: DatabaseInterface;
		remoteDb?: DatabaseInterface;
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
		} catch (err) {}
	}
});

describe("Replication to/from/sync remote, when `live == false`", () => {
	test("should replicate data one-way & when uninterrupted should communicate status as: INIT -> ACTIVE -> COMPLETED", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;
		const booksInterface = remoteDb.books();

		const replicationStore = createReplicationStore(sourceDb)(remoteDb._pouch, { live: false, retry: false, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ state }) => statusFlow.push(state));

		await replicationStore.done();

		const expectedData = await booksInterface.get(bookIds);
		const expectedStatusFlow = ["INIT", "ACTIVE", "COMPLETED"];

		expect(expectedData[0]).not.toBe(undefined);
		expect(statusFlow).toEqual(expectedStatusFlow);

		unsubscribe();
	});

	// Note: Testing for intermediate -> ACTIVE is problematic as we have to wait and check for
	// an indeterminate number of docs to be replicated, and this introduces flakiness
	test("when cancelled should communicate status as: INIT -> FAILED:CANCEL", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore(sourceDb)(remoteDb._pouch, { live: false, retry: false, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ state }) => statusFlow.push(state));

		// Explicitly cancel replication
		replicationStore.cancel();

		await replicationStore.done();

		const errorInfo = get(replicationStore.status).info;

		const expectedStatusFlow = ["INIT", "FAILED:CANCEL"];
		const exepctedErrorInfo = "local db cancelled operation";

		expect(statusFlow).toEqual(expectedStatusFlow);
		expect(errorInfo).toEqual(exepctedErrorInfo);

		unsubscribe();
	});

	// Note: not checking -> ACTIVE also applies here
	test("when something goes wrong should communicate status as: INIT -> FAILED:ERROR, and set error info", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore(sourceDb)(remoteDb._pouch, { live: false, retry: false, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ state }) => statusFlow.push(state));

		// Invoke an error by closing remote Db
		remoteDb._pouch.close();

		await replicationStore.done();

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

		const replicationStore = createReplicationStore(sourceDb)(remoteDb._pouch, { live: false, retry: false, direction: "to" });

		await replicationStore.done();

		const progress = get(replicationStore.progress);

		// manual count of docs in dummy data from "$lib/db/data/books"
		expect(progress.docsRead).toBe(23);
		// It seems with the in-memory adapters pouch adapters, pending does not exist, which means we can't calculate progress => -1
		expect(progress.progress).toBe(-1);
	});
});

describe("Replication to/from/sync remote, when `live == true`", () => {
	test("should communicate idle 'completion' & resumed activity as: INIT -> ACTIVE -> PAUSED:IDLE -> ACTIVE", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;

		const replicationStore = createReplicationStore(sourceDb)(remoteDb._pouch, { live: true, retry: false, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ state }) => statusFlow.push(state));

		// Replication should be idle after initial sourceDb data is replicated to remote
		await waitFor(() => {
			const expectedStatusFlow = ["INIT", "ACTIVE", "PAUSED:IDLE"];
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		// Then we add more books to sourceDb...
		sourceDb.books().upsert(books);

		// ... and expect replication to resume
		await waitFor(() => {
			const expectedStatusFlow = ["INIT", "ACTIVE", "PAUSED:IDLE", "ACTIVE"];

			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		unsubscribe();
	});

	test("and `retry = true`, should communicate idle 'error'", async (ctx) => {
		const { sourceDb } = ctx;

		// A remote that is currently 'offline' - our replicator will try to connect and fail...
		const errorRemote = "http://admin:admin@127.0.0.1:5000/dev";

		const replicationStore = createReplicationStore(sourceDb)(errorRemote, {
			live: true,
			retry: true,
			direction: "to"
		});

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ state }) => statusFlow.push(state));

		const expectedStatusFlow = ["INIT", "PAUSED:ERROR"];

		await waitFor(() => {
			expect(statusFlow).toEqual(expectedStatusFlow);
		});

		const errorInfo = get(replicationStore.status).info;

		expect(errorInfo).not.toEqual("");

		replicationStore.cancel();
		unsubscribe();
	});
});
