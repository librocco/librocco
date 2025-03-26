import { describe, it, expect, afterEach } from "vitest";

import { sync } from "../sync";

/**
 * Creates a mock worker interface used for testing.
 * NOTE: The mock interface performs strict checks when stopping/starting syncs:
 *  - only allows one sync at a time
 *  - throws an error if trying to stop a non-existent sync
 * This isn't necessarily the expected behaviour of the real worker interface, but is made more
 * strict to reflect our expected interaction with the worker and test for it implicitly.
 */
const createMockWorkerInterface = () => {
	type OngoingSync = {
		dbid: string;
		url: string;
	};

	let ongoingSync: OngoingSync | undefined = undefined;

	// NOTE: we're not using the 'room' property, but here for type consistency
	const startSync = (dbid: string, { url }: { url: string; room: string }) => {
		if (!dbid || !url) {
			throw new Error("starting sync with missing dbid or url");
		}

		if (ongoingSync) {
			throw new Error(
				[
					"Error: starting a new sync before stopping the previous one",
					`  ongoing: dbid: ${ongoingSync.dbid}, url: ${ongoingSync.url}`,
					`  next: dbid: ${dbid}, url: ${url}`
				].join("\n")
			);
		}

		ongoingSync = { dbid, url };
	};

	const stopSync = (dbid: string) => {
		if (!dbid) {
			throw new Error("stopping sync with missing dbid");
		}

		if (ongoingSync?.dbid !== dbid) {
			throw new Error(
				["Error: trying to stop non-existent sync", `  stopped dbid: ${dbid}`, `  ongoing dbid: ${ongoingSync?.dbid}`].join("\n")
			);
		}

		ongoingSync = undefined;
	};

	const getOngoingSync = () => ongoingSync;

	return { startSync, stopSync, getOngoingSync };
};

const dbid = "db1";
const url = "http://example.com/db1";

afterEach(() => {
	sync.reset();
});

describe("sync interface", () => {
	it("doesn't explode if running .sync() before initialised", () => {
		sync.sync({});
	});

	it("starts the sync on initialised interface, with passed config, on .sync()", () => {
		const wkr = createMockWorkerInterface();
		sync.init(wkr);

		sync.sync({ dbid, url });

		expect(wkr.getOngoingSync()).toEqual({ dbid, url });
	});

	it("allows for multiple (idempotent) .sync() calls", () => {
		const wkr = createMockWorkerInterface();
		sync.init(wkr);

		sync.sync({ dbid, url });
		sync.sync({ dbid, url });

		expect(wkr.getOngoingSync()).toEqual({ dbid, url });
	});

	it("replaces the current sync with a new one on subsequent .sync() calls", () => {
		const wkr = createMockWorkerInterface();
		sync.init(wkr);

		sync.sync({ dbid, url });

		const newConfig = { dbid: "db2", url: "http://new-url.com/db2" };
		sync.sync(newConfig);

		expect(wkr.getOngoingSync()).toEqual(newConfig);
	});

	it("doesn't explode if starting a sync with missing 'dbid' or 'url'", () => {
		const wkr = createMockWorkerInterface();
		sync.init(wkr);

		sync.sync({ dbid });
		expect(wkr.getOngoingSync()).toEqual(undefined);

		sync.sync({ url });
		expect(wkr.getOngoingSync()).toEqual(undefined);
	});

	it("stops the existing sync if calling .start() with missing 'dbid' or 'url'", () => {
		const wkr = createMockWorkerInterface();
		sync.init(wkr);

		// Start the regular sync
		sync.sync({ dbid, url });
		expect(wkr.getOngoingSync()).toEqual({ dbid, url });
		// Interrupt by specifying a new config with missing 'dbid'
		sync.sync({ url });
		expect(wkr.getOngoingSync()).toEqual(undefined);

		// Start the regular sync
		sync.sync({ dbid, url });
		expect(wkr.getOngoingSync()).toEqual({ dbid, url });
		// Interrupt by specifying a new config with missing 'url'
		sync.sync({ dbid });
		expect(wkr.getOngoingSync()).toEqual(undefined);
	});

	it("stops the ongoing sync on .stop()", () => {
		const wkr = createMockWorkerInterface();
		sync.init(wkr);

		sync.sync({ dbid, url });
		sync.stop();

		expect(wkr.getOngoingSync()).toBeUndefined();
	});

	it("doesn't explode if running .stop() before initialised", () => {
		sync.stop();
	});
});
