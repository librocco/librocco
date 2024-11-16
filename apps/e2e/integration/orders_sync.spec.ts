import { test, expect } from "@playwright/test";
import path from "path";
import { type WorkerInterface, type DB } from "@vlcn.io/ws-client";

import { baseURL } from "../constants";

const pollOpts = { intervals: Array(20).fill(null).map((_, i) => i * 500), timeout: 10000 }

test("update is reflected in table view - stock", async ({ page }) => {
	// Load the app
	const testURL = [baseURL, "preview", "tests", "orders_sync/"].join("/")
	await page.goto(testURL);

	const url = "ws://localhost:3000/sync";

	const randomTestRunId = Math.floor(Math.random() * 100000000);
	const room = randomTestRunId.toString();

	const dbid1 = `${room}-1`;
	const dbid2 = `${room}-2`;

	await page.getByText("Ready: true").waitFor();

	// Check that the remote is available (also initialise the server sync DB)
	await page.evaluate(remote.getAllCustomers, room);
	// Initialise two local dbs
	const db1 = await page.evaluateHandle(getInitializedDB, dbid1);
	const db2 = await page.evaluateHandle(getInitializedDB, dbid2);

	// Start the sync
	await page.evaluate(wkr.startSync, [dbid1, { room, url }] as const);
	await page.evaluate(wkr.startSync, [dbid2, { room, url }] as const);

	// Insert DB1 -> DB2
	await db1.evaluate(local.upsertCustomer, { fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 });
	await expect
		.poll(() => db2.evaluate(local.getAllCustomers), pollOpts)
		.toEqual([{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 }]);

	// Insert DB2 -> DB1
	await db2.evaluate(local.upsertCustomer, { fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 });
	await expect
		.poll(() => db1.evaluate(local.getAllCustomers), pollOpts)
		.toEqual([
			{ fullname: "John Doe", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
		]);

	// Update DB1 -> DB2
	await db1.evaluate(local.upsertCustomer, { fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 });
	await expect
		.poll(() => db2.evaluate(local.getAllCustomers), pollOpts)
		.toEqual([
			{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@example.com", deposit: 13.2 }
		]);

	// Update DB2 -> DB1
	await db2.evaluate(local.upsertCustomer, { fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 });
	await expect
		.poll(() => db1.evaluate(local.getAllCustomers), pollOpts)
		.toEqual([
			{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
		]);

	// Check remote for good measure
	await expect
		.poll(() => page.evaluate(remote.getAllCustomers, room), pollOpts)
		.toEqual([
			{ fullname: "John Doe the II", id: 1, email: "john@example.com", deposit: 13.2 },
			{ fullname: "Jane Doe", id: 2, email: "jane@gmail.com", deposit: 13.2 }
		]);
});

// #region helpers

// Duplicate, but it's fine
type Customer = {
	id: number;
	fullname: string;
	email: string;
	deposit: number;
};

// Extend window interface as the objects/handles we're using
// to interact with the DBs are attached to the window object within /tests/orders_sync page
declare global {
	interface Window {
		wkr: WorkerInterface;
		getInitializedDB: (dbid: string) => Promise<{ db: DB }>;
		local: {
			upsertCustomer: (db: DB, customer: Customer) => Promise<void>;
			getAllCustomers: (db: DB) => Promise<Customer[]>;
		};
		remote: {
			getAllCustomers: (dbid: string) => Promise<Customer[]>;
		};
	}
}

/**
 * Akin to `getInitializedDB` on the client side.
 *
 * IMPORTANT: should be used only within page context
 *
 * @example
 * ```ts
 * const db = await page.evaluateHandle(getInitializedDB, dbid)
 * ````
 */
const getInitializedDB = (dbid: string): Promise<DB> => window["getInitializedDB"](dbid).then(({ db }) => db);

const wkr = {
	/**
	 * Akin to `startSync` on ws-client's `WorkerInterface`
	 *
	 * IMPORTANT: should be used only within page context with `dbid` and `transportOpts`
	 * provided as params array
	 *
	 * @example
	 * ```ts
	 * const db = await page.evaluate(wkr.startSync, [dbid, {room, url}])
	 * ````
	 */
	startSync: ([dbid, transportOpts]: readonly [string, { url: string; room: string }]) => window["wkr"].startSync(dbid, transportOpts),
	/**
	 * Akin to `stopSync` on ws-client's `WorkerInterface`
	 *
	 * IMPORTANT: should be used only within page context with `dbid` provided as a param
	 *
	 * @example
	 * ```ts
	 * const db = await page.evaluate(wkr.stopSync, dbid)
	 * ````
	 */
	stopSync: (dbid: string) => window["wkr"].stopSync(dbid)
};

const local = {
	/**
	 * Akin to `local.upsertCustomer` on the client side.
	 *
	 * IMPORTANT: should be used only within JSHandle<DB> page context with
	 * customer provided as a param
	 *
	 * @example
	 * ```ts
	 * const db = await dbHandle.evaluate(local.upsertCustomer, customer)
	 * ````
	 */
	upsertCustomer: (db: DB, customer: Customer) => window["local"].upsertCustomer(db, customer),
	/**
	 * Akin to `local.getAllCustomers` on the client side.
	 *
	 * IMPORTANT: should be used only within JSHandle<DB> page context
	 *
	 * @example
	 * ```ts
	 * const db = await dbHandle.evaluate(local.getAllCustomers)
	 * ````
	 */
	getAllCustomers: (db: DB) => window["local"].getAllCustomers(db)
};

const remote = {
	/**
	 * Akin to `remote.getAllCustomers` on the client side.
	 *
	 * IMPORTANT: should be used only within page context with
	 * `dbid` (most likely the server `room`) provided as a param
	 *
	 * @example
	 * ```ts
	 * const db = await page.evaluate(remote.getAllCustomers, room)
	 * ````
	 */
	getAllCustomers: (dbid: string) => window["remote"].getAllCustomers(dbid)
};
