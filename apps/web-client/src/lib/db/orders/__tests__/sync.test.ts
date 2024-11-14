import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { WorkerInterface } from "@vlcn.io/ws-client";

import type { DB } from "../types";

import { getInitializedDB } from "../db";

import * as local from "../customers";
import * as remote from "../customers-remote";

import SyncWorker from "./worker.js?worker";
import { testUtils } from "@librocco/shared";

const url = "ws://localhost:3000/sync";

let worker: WorkerInterface;

// A helper to wait 50ms before assertion retries
// NOTE: Also waits 50ms before the first try, but we can live with that
const pause = 50;
const waitFor = (cb: () => Promise<any>) =>
	testUtils.waitFor(async () => {
		await new Promise<void>((res) => setTimeout(res, pause));
		return cb();
	});

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
		await local.upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		await waitFor(async () =>
			expect(await local.getAllCustomers(db2)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }])
		);

		// Insert + sync db2 -> db1
		await local.upsertCustomer(db2, { fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 });
		await waitFor(async () =>
			expect(await local.getAllCustomers(db1)).toEqual([
				{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
			])
		);

		// Update + sync db1 -> db2
		await local.upsertCustomer(db1, { fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 });
		await waitFor(async () =>
			expect(await local.getAllCustomers(db2)).toEqual([
				{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
			])
		);

		// Update + sync db2 -> db1
		await local.upsertCustomer(db2, { fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 });
		await waitFor(async () =>
			expect(await local.getAllCustomers(db1)).toEqual([
				{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
			])
		);

		// Test reading from the remote db directly (remember, the remote db is identified by room id).
		//
		// NOTE: Writing to remote db directly is not reactive: I don't understand the intricacies, but the writes (sync) through
		// web socket are communicated back to all subscribers, but not direct writes (I would assume it has something to do with FS locks or similar constructs)
		await waitFor(async () =>
			expect(await remote.getAllCustomers(room)).toEqual([
				{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
			])
		);
	});
});
