import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

import { getRandomDbs, syncDBs } from "./lib";
import { upsertWarehouse, deleteWarehouse } from "../warehouse";
import { createInboundNote, addVolumesToNote, commitNote } from "../note";
import * as stockCache from "../stock_cache";

// The stock cache is a module singleton; reset its activation/validity between tests.
beforeEach(() => {
	stockCache.disableRefresh();
	stockCache.invalidate();
});
afterEach(() => {
	vi.useRealTimers();
	stockCache.disableRefresh();
});

describe("stock cache invalidation (node-safe, logical-version watermark)", () => {
	it("invalidates on a synced-in commit whose committed_at predates the cache (clock skew)", async () => {
		vi.useFakeTimers();
		const [a, b] = await getRandomDbs();

		// B holds a prior committed note stamped at a LATE wall-clock time -> high MAX(committed_at).
		vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
		await upsertWarehouse(b, { id: 1, displayName: "X" });
		await createInboundNote(b, 1, 50);
		await addVolumesToNote(b, 50, { isbn: "9999999999999", quantity: 1, warehouseId: 1 });
		await commitNote(b, 50);

		// Activate + build the cache on B (captures the watermark).
		stockCache.enableRefresh(b);
		await get(stockCache.stockByWarehouse);

		let invalidations = 0;
		const off = stockCache.onInvalidated(() => invalidations++);

		// A commits at an EARLIER wall-clock time -> its legs carry committed_at < B's watermark.
		vi.setSystemTime(new Date("2026-01-01T11:59:00Z"));
		await upsertWarehouse(a, { id: 1, displayName: "X" });
		await createInboundNote(a, 1, 51);
		await addVolumesToNote(a, 51, { isbn: "8888888888888", quantity: 7, warehouseId: 1 });
		await commitNote(a, 51);

		await syncDBs(a, b);
		await stockCache.maybeInvalidate(b);

		// Old (committed_at-watermark) gate: 0 — A's committed_at < B's MAX -> permanently stale stock.
		// New (db_version-watermark) gate: must detect the synced-in commit.
		expect(invalidations).toBeGreaterThan(0);
		off();
	});

	it("invalidates when a peer deletes a warehouse (no fresh committed_at to observe)", async () => {
		const [a, b] = await getRandomDbs();

		await upsertWarehouse(a, { id: 1, displayName: "X" });
		await createInboundNote(a, 1, 60);
		await addVolumesToNote(a, 60, { isbn: "7777777777777", quantity: 3, warehouseId: 1 });
		await commitNote(a, 60);
		await syncDBs(a, b); // B now holds the warehouse and its committed stock

		stockCache.enableRefresh(b);
		await get(stockCache.stockByWarehouse);

		let invalidations = 0;
		const off = stockCache.onInvalidated(() => invalidations++);

		// Warehouse deleted on A; this changes B's derived stock (the warehouse JOIN) but writes no
		// new committed_at, so the old book_transaction-only gate never noticed it.
		await deleteWarehouse(a, 1);
		await syncDBs(a, b);
		await stockCache.maybeInvalidate(b);

		expect(invalidations).toBeGreaterThan(0);
		off();
	});
});
