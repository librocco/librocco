/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({
	browser: false
}));

const compatMocks = vi.hoisted(() => ({
	markLocalDbError: vi.fn()
}));
vi.mock("../sync-compatibility", () => compatMocks);

import type { IAppDbRx } from "$lib/app/rx";
import type { DBAsync } from "$lib/db/cr-sqlite/core/types";
import { attachPendingMonitor, classifyLocalDbError, resetPendingTracker } from "../sync-pending";

function makeFailingDb(message: string): DBAsync {
	return {
		execO: vi.fn().mockRejectedValue(new Error(message))
	} as unknown as DBAsync;
}

function makeRx(): IAppDbRx {
	return {
		onAny: vi.fn(() => () => {})
	} as unknown as IAppDbRx;
}

describe("sync-pending", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		compatMocks.markLocalDbError.mockReset();
		resetPendingTracker();
	});

	afterEach(async () => {
		await vi.runOnlyPendingTimersAsync();
		vi.useRealTimers();
		resetPendingTracker();
	});

	it("classifies lock errors as transient", () => {
		expect(classifyLocalDbError(new Error("database is locked"))).toBe("transient");
	});

	it("classifies malformed db errors as permanent", () => {
		expect(classifyLocalDbError(new Error("database disk image is malformed"))).toBe("permanent");
	});

	it("does not mark incompatibility for transient pending-count errors", async () => {
		const db = makeFailingDb("database is locked");
		const rx = makeRx();

		const monitorPromise = attachPendingMonitor(db, rx, "test-db.sqlite3");
		await vi.runAllTimersAsync();
		await monitorPromise;

		expect(compatMocks.markLocalDbError).not.toHaveBeenCalled();
	});

	it("marks incompatibility for permanent pending-count errors", async () => {
		const db = makeFailingDb("database disk image is malformed");
		const rx = makeRx();

		await attachPendingMonitor(db, rx, "test-db.sqlite3");

		expect(compatMocks.markLocalDbError).toHaveBeenCalledTimes(1);
	});
});
