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

		_worker.onmessage = (event) => {
			console.log(event.data);
		};
	});

	it.skip("upserts customer(s)", async () => {
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		const dbName = `test-${randomTestRunId}`;

		// Insert the customer
		await remote.upsertCustomer(dbName, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
		expect(await remote.getAllCustomers(dbName)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }]);

		// Try the update
		await remote.upsertCustomer(dbName, { fullname: "John Doe Updated", id: 1, email: "john@example.com", deposit: 13.2 });
		expect(await remote.getAllCustomers(dbName)).toEqual([
			{ fullname: "John Doe Updated", id: 1, email: "john@example.com", deposit: 13.2 }
		]);
	});

	it("syncs with the remote db", async () => {
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		const dbName = `test-${randomTestRunId}`;
		const room = randomTestRunId.toString();

		worker.startSync(dbName, { room, url });

		const localDB = await getInitializedDB(dbName);
		await local.upsertCustomer(localDB, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });

		await testUtils.waitFor(async () =>
			expect(await remote.getAllCustomers(dbName)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }])
		);

		// After test
		worker.stopSync(dbName);
	});
});
