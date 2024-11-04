import { describe, it, expect, beforeAll } from "vitest";
import { WorkerInterface } from "ws-client-fork";

import { getInitializedDB } from "../db";

import * as local from "../customers";
import * as remote from "../customers-remote";

import SyncWorker from "./worker.js?worker";
import { testUtils } from "@librocco/shared";

const url = "ws://localhost:3000/sync";

let worker: WorkerInterface;

describe("Remote db setup", () => {
	// Worker is set up in async manner
	beforeAll(async () => {
		const _worker = new SyncWorker();

		// Wait for worker setup
		await new Promise<void>((r) => {
			_worker.onmessage = (event) => {
				if (event.data === "ready") {
					console.log("worker ready");
					r();
				}
			};
		});

		worker = new WorkerInterface(_worker);

		// Uncomment this to get, quite verbose, logging from within the sync worker
		// _worker.onmessage = (event) => {
		// 	console.log(event.data);
		// };
	});

	it("keeps sync between client and server", async () => {
		// Get dbid - unique for each run
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		// Room is the common identifier for synced db server side: all dbs syncing with a particular room id sync with the same db
		const room = randomTestRunId.toString();

		// Create two distinct instances of db (both to sync via the remote one)
		const dbid1 = `${room}-1`;
		const dbid2 = `${room}-2`;

		// Here the dbs are created within the browser session (a client if you will).
		//
		// NOTE: the dbs need to be created (initialised) before the sync as part of the init process:
		// - loads the schema
		// - stores schema name and version (version is created with the exactly same logic as the remote db)
		// ^^^ the sync will fail if no 'schema_name' and 'schema_version' entries are found
		// - sets up reactivity (using rx-tbl) - I don't yet fully understand how
		const db1 = await getInitializedDB(dbid1);
		const db2 = await getInitializedDB(dbid2);

		// DBs are initialised, we can start sync:
		// NOTE: this starts the sync within the sync worker - the worker has access to same dbs as the ones initalised above
		worker.startSync(dbid1, { room, url });
		worker.startSync(dbid2, { room, url });

		// Insert + sync db1 -> db2
		await local.upsertCustomer(db1, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		await testUtils.waitFor(async () =>
			expect(await local.getAllCustomers(db2)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }])
		);

		// Insert + sync db2 -> db1
		await local.upsertCustomer(db2, { fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 });
		await testUtils.waitFor(async () =>
			expect(await local.getAllCustomers(db1)).toEqual([
				{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
			])
		);

		// Update + sync db1 -> db2
		await local.upsertCustomer(db1, { fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 });
		await testUtils.waitFor(async () =>
			expect(await local.getAllCustomers(db2)).toEqual([
				{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
			])
		);

		// Update + sync db2 -> db1
		await local.upsertCustomer(db2, { fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 });
		await testUtils.waitFor(async () =>
			expect(await local.getAllCustomers(db1)).toEqual([
				{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
			])
		);

		// Test reading from the remote db directly (remember, the remote db is identified by room id).
		//
		// NOTE: Writing to remote db directly is not reactive: I don't understand the intricacies, but the writes (sync) through
		// web socket are communicated back to all subscribers, but not direct writes (I would assume it has something to do with FS locks or similar constructs)
		await testUtils.waitFor(async () =>
			expect(await remote.getAllCustomers(room)).toEqual([
				{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
				{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
			])
		);

		// Be a good citizen
		worker.stopSync(dbid1);
		worker.stopSync(dbid2);
	});
});
