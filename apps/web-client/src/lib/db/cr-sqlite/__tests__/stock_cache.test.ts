import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getRandomDb, getRandomDbs, syncDBs } from "./lib";

import type { DBAsync } from "../types";

import { upsertBook } from "../books";
import { upsertWarehouse, deleteWarehouse } from "../warehouse";
import { getStock } from "../stock";
import { getDBVersion } from "../db";
import {
	addVolumesToNote,
	createInboundNote,
	createOutboundNote,
	commitNote,
	deleteNote,
	createAndCommitReconciliationNote
} from "../note";

import { getCachedStock, rebuildStockCache, isStockCacheStale, hasStockCacheSnapshot } from "../stock_cache_db";

import { enableRefresh, disableRefresh, invalidate, maybeInvalidate, onInvalidated, warehouseTotals } from "../stock_cache";

const maxCommittedAt = async (db: DBAsync) =>
	(await db.execA<[number]>("SELECT COALESCE(MAX(committed_at), 0) FROM book_transaction"))[0][0];
const watermarkMissCount = async (db: DBAsync, watermark: number) =>
	(await db.execA<[number]>("SELECT COUNT(*) FROM book_transaction WHERE committed_at > ?", [watermark]))[0][0];
const metaVersion = async (db: DBAsync) =>
	(await db.execA<[number]>("SELECT COALESCE((SELECT db_version FROM stock_cache_meta WHERE id = 0), -1)"))[0][0];

describe("persistent stock cache (stock_cache_db)", () => {
	it("matches getStock across inbound, outbound, reconciliation and uncommitted notes", async () => {
		const db = await getRandomDb();

		// Books (metadata) + warehouses with a discount
		await upsertBook(db, { isbn: "1111111111", title: "Physics", authors: "Newton", publisher: "Pub", price: 7, year: "1999" });
		await upsertBook(db, { isbn: "2222222222", title: "Chemistry", authors: "Curie", price: 13 });
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1", discount: 10 });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		// Inbound into both warehouses
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "2222222222", quantity: 8, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 15, warehouseId: 2 });
		await commitNote(db, 2);

		// Outbound across both warehouses
		await createOutboundNote(db, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 3, warehouseId: 2 });
		await commitNote(db, 3);

		// Reconciliation (counts as inbound)
		await createAndCommitReconciliationNote(db, 4, [{ isbn: "2222222222", quantity: 2, warehouseId: 2 }]);

		// Uncommitted note must NOT count
		await createInboundNote(db, 1, 5);
		await addVolumesToNote(db, 5, { isbn: "1111111111", quantity: 100, warehouseId: 1 });

		// The cache must be byte-for-byte identical to the live fold...
		const live = await getStock(db);
		const cached = await getCachedStock(db);
		expect(cached).toEqual(live);

		// ...and reflect the expected quantities + joined metadata.
		expect(cached).toEqual([
			expect.objectContaining({ isbn: "1111111111", warehouseId: 1, quantity: 5, title: "Physics", warehouseDiscount: 10 }),
			expect.objectContaining({ isbn: "1111111111", warehouseId: 2, quantity: 12 }),
			expect.objectContaining({ isbn: "2222222222", warehouseId: 1, quantity: 8, title: "Chemistry" }),
			expect.objectContaining({ isbn: "2222222222", warehouseId: 2, quantity: 2 })
		]);
	});

	it("omits zero-quantity entries, exactly like getStock", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });

		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		await createOutboundNote(db, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 2);

		expect(await getCachedStock(db)).toEqual([]);
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("building the cache does not move the logical clock (no self-invalidation)", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		const before = await getDBVersion(db);
		await rebuildStockCache(db);
		const after = await getDBVersion(db);

		// The cache tables are non-CRR; writing them must not advance crsql_db_version()...
		expect(after).toBe(before);
		// ...so a freshly built snapshot reads as fresh (no infinite rebuild loop).
		expect(await isStockCacheStale(db)).toBe(false);
	});

	it("serves the persisted snapshot without recomputing while the clock is unchanged, then rebuilds when it moves", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		await getCachedStock(db); // build snapshot
		expect(await isStockCacheStale(db)).toBe(false);

		// Tamper the persisted aggregate directly. This is a non-CRR write -> does NOT move the clock.
		await db.exec("INSERT INTO stock_cache (isbn, warehouse_id, quantity) VALUES ('BOGUS', 1, 999)");
		expect(await isStockCacheStale(db)).toBe(false);

		// Because it isn't stale, getCachedStock must READ the persisted table (bogus row and all),
		// proving it served from cache rather than recomputing.
		const served = await getCachedStock(db);
		expect(served.some((r) => r.isbn === "BOGUS")).toBe(true);

		// A real committed change moves the clock -> stale -> recompute from source drops the bogus row.
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 1, warehouseId: 1 });
		await commitNote(db, 2);

		expect(await isStockCacheStale(db)).toBe(true);
		const fresh = await getCachedStock(db);
		expect(fresh.some((r) => r.isbn === "BOGUS")).toBe(false);
		expect(fresh.find((r) => r.isbn === "1111111111")?.quantity).toBe(6);
	});

	it("invalidates on deletion of committed transactions — which a committed_at watermark misses", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		await getCachedStock(db);
		const watermark = await maxCommittedAt(db);
		expect(await isStockCacheStale(db)).toBe(false);

		// Delete the warehouse -> its committed book_transaction legs are removed.
		await deleteWarehouse(db, 1);

		// The OLD watermark gate would miss this: a deletion creates no row with committed_at > watermark.
		expect(await watermarkMissCount(db, watermark)).toBe(0);

		// The logical-clock gate catches it, and the recompute reflects the deletion.
		expect(await isStockCacheStale(db)).toBe(true);
		expect(await getCachedStock(db)).toEqual([]);
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("invalidates when an uncommitted note's transactions are deleted then re-evaluated", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		// A second (committed) note, then delete it before commit-equivalent: use an uncommitted note delete.
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 7, warehouseId: 1 });

		await getCachedStock(db); // snapshot sees only committed note 1 (qty 5)
		expect((await getCachedStock(db)).find((r) => r.isbn === "1111111111")?.quantity).toBe(5);

		await deleteNote(db, 2); // delete the uncommitted note (a book_transaction delete -> clock moves)
		expect(await isStockCacheStale(db)).toBe(true);
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("invalidates on out-of-order synced commits — which a committed_at watermark misses", async () => {
		const [db1, db2] = await getRandomDbs();

		// db2: its own committed stock (high committed_at) and a built cache.
		await upsertWarehouse(db2, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db2, 2, 1);
		await addVolumesToNote(db2, 1, { isbn: "2222222222", quantity: 4, warehouseId: 2 });
		await commitNote(db2, 1);

		await getCachedStock(db2);
		const db2Watermark = await maxCommittedAt(db2);
		expect(await isStockCacheStale(db2)).toBe(false);

		// db1: commit a note, then force its committed_at LOW (a lagging / clock-skewed peer).
		await upsertWarehouse(db1, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db1, 1, 100);
		await addVolumesToNote(db1, 100, { isbn: "1111111111", quantity: 9, warehouseId: 1 });
		await commitNote(db1, 100);
		await db1.exec("UPDATE book_transaction SET committed_at = 1 WHERE note_id = 100");
		await db1.exec("UPDATE note SET committed_at = 1 WHERE id = 100");

		// Sync db1 -> db2: db2 now holds db1's committed rows, but with committed_at = 1 (< db2's watermark).
		await syncDBs(db1, db2);

		// OLD watermark gate misses it (the synced rows sit below the watermark).
		expect(await watermarkMissCount(db2, db2Watermark)).toBe(0);

		// Logical-clock gate catches it; the recompute reflects the synced stock.
		expect(await isStockCacheStale(db2)).toBe(true);
		const stock = await getCachedStock(db2);
		expect(stock.find((r) => r.isbn === "1111111111" && r.warehouseId === 1)?.quantity).toBe(9);
		expect(stock.find((r) => r.isbn === "2222222222" && r.warehouseId === 2)?.quantity).toBe(4);
		expect(stock).toEqual(await getStock(db2));
	});

	it("self-heals if the cache tables are dropped (e.g. by a schema migration)", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		await getCachedStock(db);
		expect(await hasStockCacheSnapshot(db)).toBe(true);

		// cr-sqlite's automigrate drops unknown tables; emulate that (both cache tables go).
		await db.exec("DROP TABLE stock_cache");
		await db.exec("DROP TABLE stock_cache_meta");

		// Next access recreates + repopulates with the correct stock.
		const healed = await getCachedStock(db);
		expect(healed.find((r) => r.isbn === "1111111111")?.quantity).toBe(5);
		expect(healed).toEqual(await getStock(db));
	});
});

describe("reactive stock cache (stock_cache store)", () => {
	// The store is a module singleton; reset its activation + validity between tests so a leftover
	// `valid`/published query from a prior test's db can't bleed in.
	beforeEach(() => {
		disableRefresh();
		invalidate();
	});
	afterEach(() => disableRefresh());

	// Resolve once warehouseTotals reports the expected total for a warehouse. This deterministically
	// awaits the (possibly background) refresh rather than reading a single, maybe-not-yet-settled value.
	const waitForWarehouseTotal = (warehouseId: number, expected: number, timeoutMs = 5000) =>
		new Promise<void>((resolve, reject) => {
			let settled = false;
			let unsub = () => {};
			const finish = (fn: () => void) => {
				if (settled) return;
				settled = true;
				unsub();
				clearTimeout(timer);
				fn();
			};
			const timer = setTimeout(
				() => finish(() => reject(new Error(`timed out waiting for warehouse ${warehouseId} total ${expected}`))),
				timeoutMs
			);
			unsub = warehouseTotals.subscribe(($p) => {
				// A warehouse with no stock is absent from the map; treat that as a total of 0.
				$p.then((m) => (m.get(warehouseId) ?? 0) === expected && finish(resolve)).catch(() => {});
			});
		});

	it("enableRefresh publishes correct per-warehouse totals", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });

		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await addVolumesToNote(db, 1, { isbn: "2222222222", quantity: 3, warehouseId: 1 });
		await commitNote(db, 1);

		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 4, warehouseId: 2 });
		await commitNote(db, 2);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 10);
		await waitForWarehouseTotal(2, 4);
	});

	it("maybeInvalidate refreshes totals after a committed change", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);

		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 2);

		await maybeInvalidate(db);
		await waitForWarehouseTotal(1, 10);
	});

	it("maybeInvalidate is a noop while inactive (no rebuild until a consumer re-activates)", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		// Build a snapshot, then go inactive.
		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);
		disableRefresh();
		const versionAtSnapshot = await metaVersion(db);

		// A change lands while inactive...
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 2);

		// ...maybeInvalidate must not rebuild while inactive (snapshot version unchanged).
		await maybeInvalidate(db);
		expect(await metaVersion(db)).toBe(versionAtSnapshot);
		expect(await isStockCacheStale(db)).toBe(true);

		// Re-activating paints the (stale) snapshot, then refreshes in the background to reflect the change.
		enableRefresh(db);
		await waitForWarehouseTotal(1, 10);
	});

	// The production bug class (D-217 / #1249): a commit synced in from a lagging or clock-skewed peer
	// carries a committed_at below the local wall-clock watermark. The old gate missed it and the
	// connected node showed permanently-stale (too-low) stock. End-to-end via the public store API.
	it("refreshes totals (and fires onInvalidated) on a synced-in, clock-skewed peer commit", async () => {
		const [db1, db2] = await getRandomDbs();

		// db2: its own committed stock with a HIGH wall-clock committed_at, plus an active, built cache.
		await upsertWarehouse(db2, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db2, 2, 1);
		await addVolumesToNote(db2, 1, { isbn: "2222222222", quantity: 4, warehouseId: 2 });
		await commitNote(db2, 1);

		enableRefresh(db2);
		await waitForWarehouseTotal(2, 4);

		let invalidations = 0;
		const off = onInvalidated(() => invalidations++);

		// db1 commits into the same warehouse but forces a LOW committed_at (a lagging / skewed peer).
		await upsertWarehouse(db1, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db1, 2, 100);
		await addVolumesToNote(db1, 100, { isbn: "2222222222", quantity: 5, warehouseId: 2 });
		await commitNote(db1, 100);
		await db1.exec("UPDATE book_transaction SET committed_at = 1 WHERE note_id = 100");
		await db1.exec("UPDATE note SET committed_at = 1 WHERE id = 100");

		// The synced rows sit below db2's wall-clock watermark but advance db2's logical clock, so the
		// store must notice and repaint to the merged total (4 + 5).
		await syncDBs(db1, db2);
		await maybeInvalidate(db2);

		await waitForWarehouseTotal(2, 9);
		expect(invalidations).toBeGreaterThan(0);
		off();
	});

	it("refreshes totals when a peer deletes a warehouse (deletion arrives via sync)", async () => {
		const [db1, db2] = await getRandomDbs();

		await upsertWarehouse(db1, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db1, 1, 1);
		await addVolumesToNote(db1, 1, { isbn: "1111111111", quantity: 6, warehouseId: 1 });
		await commitNote(db1, 1);
		await syncDBs(db1, db2); // db2 now holds the warehouse and its committed stock

		enableRefresh(db2);
		await waitForWarehouseTotal(1, 6);

		// The deletion writes no fresh committed_at — only the logical-clock gate can catch it.
		await deleteWarehouse(db1, 1);
		await syncDBs(db1, db2);
		await maybeInvalidate(db2);

		await waitForWarehouseTotal(1, 0);
	});
});
