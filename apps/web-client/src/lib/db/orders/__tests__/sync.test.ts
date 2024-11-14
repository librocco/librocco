import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { WorkerInterface } from "@vlcn.io/ws-client";

import type { DB } from "../types";

import { getInitializedDB } from "../db";

import * as local from "../customers";
import * as remote from "../customers-remote";

import SyncWorker from "./worker.js?worker";

const url = "ws://localhost:3000/sync";

let worker: WorkerInterface;

/** A helper used to wrap the 'expect.poll', providing handsome time buffers for each assertion */
const waitFor = (cb: () => any | Promise<any>) => expect.poll(cb, { timeout: 15000, interval: 2000 });

describe("Remote db setup", () => {
	// Worker is set up in async manner
	beforeAll(async () => {
		const _worker = new SyncWorker();
		worker = new WorkerInterface(_worker);
	});

	let room: string;
	let dbid1: string;
	let dbid2: string;
	let db1: DB;
	let db2: DB;

	beforeEach(async () => {
		// Get dbid - unique for each run
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		// Room is the common identifier for synced db server side: all dbs syncing with a particular room id sync with the same db
		room = randomTestRunId.toString();

		// Create two distinct instances of db (both to sync via the remote one)
		dbid1 = `${room}-1`;
		dbid2 = `${room}-2`;

		db1 = await getInitializedDB(dbid1).then(({ db }) => db);
		db2 = await getInitializedDB(dbid2).then(({ db }) => db);

		// Start the sync
		worker.startSync(dbid1, { room, url });
		worker.startSync(dbid2, { room, url });

		// Ping the backend to initialise the DB before tests are run
		await remote.getAllCustomers(room);
	});

	afterEach(() => {
		worker.stopSync(dbid1);
		worker.stopSync(dbid2);
	});

	it("keeps sync between client and server", async () => {
		// Insert + sync db1 -> db2
		//
		// NOTE: upsert customer aren't awaited on purpose...I don't know why this happens, but if we await them
		// and they take a long time (e.g. in CI), the rest of the sync stops working.
		// My hunch is it has something to do with thread sleeping for too long and (maybe being shut down) or something:
		// these tests are ran in multitude of simulated environments (node, headless browser) so it's hard to know for sure
		local.upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		// Wait for remote to get updated first (this lets us know the sync is working)
		// NOTE: This shouldn't be necessary, but it seems the tests work only if we first wait for sync to show signs of life before continuing with updates.
		// As is apparent from the rest of the test, this is necessary only once.
		// This shouldn't be so...sync should be working (it's set up in beforeEach block anyway), but here we are:
		// My hunch is: it has something to do with different environments the test is run
		await waitFor(() => remote.getAllCustomers(room)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }]);
		await waitFor(() => local.getAllCustomers(db2)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }]);

		// Insert + sync db2 -> db1
		local.upsertCustomer(db2, { fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 });
		await waitFor(() => local.getAllCustomers(db1)).toEqual([
			{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
		]);

		// Update + sync db1 -> db2
		local.upsertCustomer(db1, { fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 });
		await waitFor(() => local.getAllCustomers(db2)).toEqual([
			{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
		]);

		// Update + sync db2 -> db1
		local.upsertCustomer(db2, { fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 });
		await waitFor(() => local.getAllCustomers(db1)).toEqual([
			{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
		]);

		// Test reading from the remote db directly (remember, the remote db is identified by room id).
		//
		// NOTE: Writing to remote db directly is not reactive: I don't understand the intricacies, but the writes (sync) through
		// web socket are communicated back to all subscribers, but not direct writes (I would assume it has something to do with FS locks or similar constructs)
		await waitFor(() => remote.getAllCustomers(room)).toEqual([
			{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
		]);
	});
});
