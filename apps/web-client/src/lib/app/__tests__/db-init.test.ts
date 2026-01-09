/** @vitest-environment node */
import { describe, it, expect, vi } from "vitest";
import { get } from "svelte/store";
import type { App } from "../index";

vi.mock("$lib/db/cr-sqlite/db", () => {
	const db = {
		execA: vi.fn().mockResolvedValue([["ok"]]),
		exec: vi.fn().mockResolvedValue(undefined),
		automigrateTo: vi.fn().mockResolvedValue("ok")
	};

	return {
		getDB: vi.fn().mockResolvedValue(db),
		getSchemaNameAndVersion: vi.fn().mockResolvedValue(["schema", 1]),
		schemaContent: "schema",
		schemaName: "schema",
		schemaVersion: 1
	};
});

vi.mock("@vlcn.io/rx-tbl", () => ({
	default: () => ({
		onPoint: () => () => {},
		onRange: () => () => {},
		onAny: () => () => {}
	})
}));

import { AppDb, AppDbState, initializeDb } from "../db";
import { getDB } from "$lib/db/cr-sqlite/db";

describe("initializeDb", () => {
	it("initializes when dbid matches but state is Loading", async () => {
		const app = { db: new AppDb() } as App;
		const dbid = "test-db";

		// Mirrors reset flow: dbid matches, but state is stuck in Loading before init.
		app.db.dbid = dbid;
		app.db.setState(dbid, AppDbState.Loading);

		await initializeDb(app, dbid, "asyncify-idb-batch-atomic");

		// Expect init to run and complete; the current early return prevents this.
		expect(getDB).toHaveBeenCalledOnce();
		expect(get(app.db.state)).toBe(AppDbState.Ready);
	});
});
