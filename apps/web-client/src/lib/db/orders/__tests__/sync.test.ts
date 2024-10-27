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

	it("upserts customer(s)", async () => {
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

	it("syncs with the remote db: server - client", async () => {
		const randomTestRunId = Math.floor(Math.random() * 100000000);
		const room = randomTestRunId.toString();

		console.log("[test]", "upserting customer");
		await remote.upsertCustomer(room, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });

		console.log("[test]", "waiting for a second before proceeding with the test");
		await new Promise((r) => setTimeout(r, 1000));

		console.log("[test]", "creating local db");
		const localDB = await getInitializedDB(room);

		console.log("[test]", "starting sync");
		worker.startSync(room, { room, url });

		console.log("[test]", "waiting for a second before proceeding with the test");
		await new Promise((r) => setTimeout(r, 1000));

		console.log("[test]", "waiting for assertion");
		await testUtils.waitFor(async () =>
			expect(await local.getAllCustomers(localDB)).toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }])
		);

		// After test
		worker.stopSync(room);
	});
});
