import { describe, it, expect } from "vitest";
import { WorkerInterface } from "@vlcn.io/ws-client";

import { getInitializedDB } from "../db";

import * as local from "../customers";
import * as remote from "../customers-remote";

import SyncWorker from "./worker.js?worker";
import { testUtils } from "@librocco/shared";
const _worker = new SyncWorker();
const worker = new WorkerInterface(_worker);

_worker.onmessage = (event) => {
	console.log(event.data)
};

const url = "ws://localhost:3000/sync";

describe("Remote db setup", () => {
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
