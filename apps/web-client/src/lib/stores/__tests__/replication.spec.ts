import { test, expect, describe, beforeEach, afterEach } from "vitest";

import { newTestDB } from "$lib/__testUtils__/db";

import { default as bookData } from "$lib/db/data/books";
import type { BookEntry, DatabaseInterface } from "@librocco/db";

import { createReplicationStore, ReplicationStatus } from "../replication";

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
	await ctx.remoteDb._pouch.destroy();
});

describe("Replication to/from remote, when `live == false`", () => {
	test("should replicate data one-way & when uninterrupted should communicate status as: INACTIVE -> ACTIVE -> COMPLETE", async (ctx) => {
		const { remoteDb, sourceDb } = ctx;
		const booksInterface = remoteDb.books();

		const replicationStore = createReplicationStore(sourceDb)(remoteDb._pouch, { live: false, retry: false, direction: "to" });

		const statusFlow = [];
		const unsubscribe = replicationStore.status.subscribe(({ status }) => statusFlow.push(status));

		await replicationStore.done();

		const expectedData = await booksInterface.get(bookIds);
		const expectedStatusFlow = [ReplicationStatus.Inactive, ReplicationStatus.Active, ReplicationStatus.Complete];

		expect(expectedData[0]).not.toBe(undefined);
		expect(statusFlow).toEqual(expectedStatusFlow);

		unsubscribe();
	});
});
