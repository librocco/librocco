import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getRandomDb, getRandomDbs, syncDBs } from "./lib";

import type { DBAsync } from "../types";

import { upsertBook } from "../books";
import { upsertCustomer } from "../customers";
import { upsertWarehouse, deleteWarehouse } from "../warehouse";
import { getStock } from "../stock";
import { getDBVersion, getChanges, applyChanges } from "../db";
import {
	addVolumesToNote,
	createInboundNote,
	createOutboundNote,
	commitNote,
	deleteNote,
	updateNote,
	updateNoteTxn,
	createAndCommitReconciliationNote
} from "../note";

import { getCachedStock, rebuildStockCache, refreshStockCache, isStockCacheStale, hasStockCacheSnapshot } from "../stock_cache_db";

import {
	enableRefresh,
	disableRefresh,
	invalidate,
	maybeInvalidate,
	onInvalidated,
	warehouseTotals,
	stockByWarehouse
} from "../stock_cache";

const maxCommittedAt = async (db: DBAsync) =>
	(await db.execA<[number]>("SELECT COALESCE(MAX(committed_at), 0) FROM book_transaction"))[0][0];
const watermarkMissCount = async (db: DBAsync, watermark: number) =>
	(await db.execA<[number]>("SELECT COUNT(*) FROM book_transaction WHERE committed_at > ?", [watermark]))[0][0];
const metaVersion = async (db: DBAsync) =>
	(await db.execA<[number]>("SELECT COALESCE((SELECT db_version FROM stock_cache_meta WHERE id = 0), -1)"))[0][0];
// Plant a marker row in a warehouse's slice of the materialised table. A later refresh DROPS it iff
// it refolds that warehouse — letting tests prove exactly which slices were (not) rebuilt.
const tamperSlice = (db: DBAsync, warehouseId: number) =>
	db.exec("INSERT INTO stock_cache (isbn, warehouse_id, quantity) VALUES ('TAMPER', ?, 999)", [warehouseId]);
const sliceTampered = async (db: DBAsync, warehouseId: number) =>
	!!(await db.execA<[number]>("SELECT COUNT(*) FROM stock_cache WHERE isbn = 'TAMPER' AND warehouse_id = ?", [warehouseId]))[0][0];

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
		await tamperSlice(db, 1);
		expect(await isStockCacheStale(db)).toBe(false);

		// Because it isn't stale, getCachedStock must READ the persisted table (tamper row and all),
		// proving it served from cache rather than recomputing.
		const served = await getCachedStock(db);
		expect(served.some((r) => r.isbn === "TAMPER")).toBe(true);

		// A real committed change moves the clock -> stale -> recompute from source drops the tamper row.
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 1, warehouseId: 1 });
		await commitNote(db, 2);

		expect(await isStockCacheStale(db)).toBe(true);
		const fresh = await getCachedStock(db);
		expect(fresh.some((r) => r.isbn === "TAMPER")).toBe(false);
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

	it("invalidates when an uncommitted note (with its transactions) is deleted", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 1);

		// A second, uncommitted note...
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 7, warehouseId: 1 });

		await getCachedStock(db); // snapshot sees only committed note 1 (qty 5)
		expect((await getCachedStock(db)).find((r) => r.isbn === "1111111111")?.quantity).toBe(5);

		// ...is deleted: the note row is gone, so its legs' tombstones can't be proven draft-only and
		// the cache (correctly, conservatively) re-evaluates.
		await deleteNote(db, 2);
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

describe("per-warehouse, event-filtered invalidation (stock_cache_db)", () => {
	// Common fixture: two warehouses with committed stock + a built snapshot.
	const setupTwoWarehouses = async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db, 1);
		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 20, warehouseId: 2 });
		await commitNote(db, 2);
		await getCachedStock(db); // build + stamp
		return db;
	};

	it("refolds ONLY the warehouses whose stock changed (other slices untouched)", async () => {
		const db = await setupTwoWarehouses();

		// Tamper BOTH slices: whichever slice the next refresh refolds loses its marker.
		await tamperSlice(db, 1);
		await tamperSlice(db, 2);

		// A committed change in warehouse 1 only.
		await createInboundNote(db, 1, 3);
		await addVolumesToNote(db, 3, { isbn: "1111111111", quantity: 5, warehouseId: 1 });
		await commitNote(db, 3);

		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([1]));

		// Warehouse 1's slice was refolded (marker gone, value fresh); warehouse 2's was NOT touched.
		expect(await sliceTampered(db, 1)).toBe(false);
		expect(await sliceTampered(db, 2)).toBe(true);
		const stock = await getCachedStock(db);
		expect(stock.find((r) => r.isbn === "1111111111")?.quantity).toBe(15);

		// A full rebuild restores exact parity (clears the remaining marker).
		await rebuildStockCache(db);
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("ignores writes to stock-irrelevant tables (no refold, no staleness, watermark advances)", async () => {
		const db = await setupTwoWarehouses();
		await tamperSlice(db, 1);

		await upsertBook(db, { isbn: "1111111111", title: "Retitled", price: 99 });
		await upsertCustomer(db, { id: 1, fullname: "Customer", displayId: "1" });

		expect(await isStockCacheStale(db)).toBe(false);
		const versionBefore = await metaVersion(db);
		const { changed } = await refreshStockCache(db);
		expect(changed).toBe(false);
		// The refresh did no refolding (marker survives) but still advanced the watermark past the
		// irrelevant writes, keeping future scans short.
		expect(await sliceTampered(db, 1)).toBe(true);
		expect(await metaVersion(db)).toBeGreaterThan(versionBefore);
	});

	it("ignores draft-note editing noise: create, add volumes, bump quantities, rename", async () => {
		const db = await setupTwoWarehouses();
		await tamperSlice(db, 1);
		await tamperSlice(db, 2);

		// A draft outbound note being actively edited (the high-frequency UI path: every scan of a
		// book inserts or quantity-bumps a leg).
		await createOutboundNote(db, 10);
		await addVolumesToNote(db, 10, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await addVolumesToNote(db, 10, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await updateNote(db, 10, { displayName: "Renamed draft" });

		// None of it affects committed stock: not stale, nothing refolded.
		expect(await isStockCacheStale(db)).toBe(false);
		const { changed } = await refreshStockCache(db);
		expect(changed).toBe(false);
		expect(await sliceTampered(db, 1)).toBe(true);
		expect(await sliceTampered(db, 2)).toBe(true);

		// Sanity: the draft still doesn't count, parity holds (after clearing the markers).
		await rebuildStockCache(db);
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("a draft line removal/move DOES refold (value-identically): tombstones are never trusted to be draft-only", async () => {
		const db = await setupTwoWarehouses();

		// Note ids are recycled (MAX(id)+1), so a leg tombstone's note_id may resolve to a LATER,
		// unrelated note — its current committed state proves nothing about the deleted leg. Row
		// deletions therefore always count; the refold they trigger here is value-identical.
		await createOutboundNote(db, 10);
		await addVolumesToNote(db, 10, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await refreshStockCache(db); // absorb the (silent) draft writes

		const before = await getCachedStock(db);
		// Moving the draft line is a DELETE + re-INSERT: the tombstone dirties the OLD warehouse
		// (the new leg is a plain draft insert — still silent).
		await updateNoteTxn(db, 10, { isbn: "1111111111", warehouseId: 1 }, { warehouseId: 2, quantity: 3 });
		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([1]));
		expect(await getCachedStock(db)).toEqual(before);
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("a commit dirties exactly the committed note's warehouses", async () => {
		const db = await setupTwoWarehouses();

		// An outbound draft touching only warehouse 2...
		await createOutboundNote(db, 10);
		await addVolumesToNote(db, 10, { isbn: "2222222222", quantity: 4, warehouseId: 2 });
		await refreshStockCache(db); // absorb the (ignored) draft writes

		// ...commits: only warehouse 2 is affected.
		await commitNote(db, 10);
		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([2]));
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("deleteWarehouse dirties that warehouse (and the unassigned bucket its draft legs move to) and empties its slice", async () => {
		const db = await setupTwoWarehouses();
		// An open outbound draft with a leg in warehouse 1 (exercises the SET warehouse_id = 0 path).
		await createOutboundNote(db, 10);
		await addVolumesToNote(db, 10, { isbn: "1111111111", quantity: 1, warehouseId: 1 });
		await refreshStockCache(db);
		await tamperSlice(db, 2);

		await deleteWarehouse(db, 1);

		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		// Warehouse 1: committed legs deleted + the draft leg's pk-move tombstone. Bucket 0: the
		// draft leg's create-sentinel (a pk move sentinels both sides; sentinels always count). Its
		// refold is a no-op — drafts never fold — so the values stay exact.
		expect(warehouseIds).toEqual(new Set([1, 0]));
		expect(await sliceTampered(db, 2)).toBe(true); // warehouse 2 untouched

		const stock = await getCachedStock(db);
		expect(stock.some((r) => r.warehouseId === 1)).toBe(false);
		expect(stock.some((r) => r.warehouseId === 0)).toBe(false);
		await rebuildStockCache(db); // clear the marker, then parity
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("catches a deleted note whose id is RECYCLED as a draft before the next refresh (id-reuse cannot mask tombstones)", async () => {
		const db = await setupTwoWarehouses(); // note 2 (committed, warehouse 2) holds MAX(id)

		// Warehouse 2 is deleted: its committed note 2 and that note's legs go with it...
		await deleteWarehouse(db, 2);
		// ...and before any refresh happens, the freed id 2 is reborn as someone's DRAFT note (this
		// is how getNoteIdSeq allocates: MAX(id)+1). The old legs' tombstones now resolve to a
		// draft note — judging them by its committed state would skip the refold and leave phantom
		// warehouse-2 stock forever.
		await createInboundNote(db, 1, 2);

		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([2]));
		const stock = await getCachedStock(db);
		expect(stock.some((r) => r.warehouseId === 2)).toBe(false);
		expect(stock).toEqual(await getStock(db));
	});

	it("catches an un-commit (direct/remediation SQL) and attributes all the note's warehouses", async () => {
		const db = await setupTwoWarehouses();

		// A committed outbound note with legs in BOTH warehouses.
		await createOutboundNote(db, 10);
		await addVolumesToNote(db, 10, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await addVolumesToNote(db, 10, { isbn: "2222222222", quantity: 3, warehouseId: 2 });
		await commitNote(db, 10);
		await refreshStockCache(db);

		// No app path un-commits, but remediation SQL (or a peer's) can. The legs themselves don't
		// change — only the note row — so this MUST be caught via the note scan, with no
		// current-state gating (the flip is exactly a change the current state can't witness).
		await db.exec("UPDATE note SET committed = 0 WHERE id = 10");
		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([1, 2]));
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("falls back to a full rebuild when the watermark is ahead of the live clock (clock regression)", async () => {
		const db = await setupTwoWarehouses();
		await tamperSlice(db, 1);

		// Simulate cache tables surviving some future db-replacement path: the stored watermark no
		// longer relates to this db's clock. It must not be trusted.
		await db.exec("UPDATE stock_cache_meta SET db_version = db_version + 1000 WHERE id = 0");
		expect(await isStockCacheStale(db)).toBe(true);

		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toBeNull();
		expect(await sliceTampered(db, 1)).toBe(false); // full rebuild dropped the marker
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("bails to a full rebuild when the pending backlog exceeds the attribution threshold", async () => {
		const db = await setupTwoWarehouses();
		await tamperSlice(db, 2);

		// One small committed change in warehouse 1...
		await createInboundNote(db, 1, 10);
		await addVolumesToNote(db, 10, { isbn: "1111111111", quantity: 1, warehouseId: 1 });
		await commitNote(db, 10);

		// ...but with the attribution limit forced to 0, ANY backlog is "too large to be worth
		// attributing": the refresh must skip the scans and take the full-rebuild path.
		const { changed, warehouseIds } = await refreshStockCache(db, 0);
		expect(changed).toBe(true);
		expect(warehouseIds).toBeNull();
		expect(await sliceTampered(db, 2)).toBe(false); // full rebuild, not a slice refold
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("stays correct when a peer's transaction arrives split across merge chunks (refresh between chunks)", async () => {
		const [db1, db2] = await getRandomDbs();

		// Shared baseline, cache built on db2.
		await upsertWarehouse(db1, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db1, 1, 1);
		await addVolumesToNote(db1, 1, { isbn: "1111111111", quantity: 6, warehouseId: 1 });
		await commitNote(db1, 1);
		await syncDBs(db1, db2);
		await getCachedStock(db2);

		// db1 commits another note; the sync layer chunks large changesets (MAX_SYNC_CHUNK_SIZE),
		// so the receiver can observe a half-applied logical transaction between chunks. The cache
		// must match the live fold at EVERY observable point, whatever the split.
		// `since` is snapshotted BEFORE the new note so `changes` holds exactly its cells and the
		// midpoint split lands genuinely inside the logical transaction.
		const since = await getDBVersion(db1);
		await createInboundNote(db1, 1, 2);
		await addVolumesToNote(db1, 2, { isbn: "2222222222", quantity: 4, warehouseId: 1 });
		await commitNote(db1, 2);

		const changes = await getChanges(db1, since);
		expect(changes.length).toBeGreaterThan(2);
		const mid = Math.ceil(changes.length / 2);

		const versionBeforeChunk1 = await getDBVersion(db2);
		await applyChanges(db2, changes.slice(0, mid));
		// Guard against this test going vacuous: the first chunk must actually apply something.
		expect(Number(await getDBVersion(db2))).toBeGreaterThan(Number(versionBeforeChunk1));
		expect(await getCachedStock(db2)).toEqual(await getStock(db2));

		await applyChanges(db2, changes.slice(mid));
		expect(await getCachedStock(db2)).toEqual(await getStock(db2));
		expect((await getCachedStock(db2)).find((r) => r.isbn === "2222222222")?.quantity).toBe(4);
	});

	it("catches direct (peer-style) edits to committed legs: update, delete, resurrection", async () => {
		const db = await setupTwoWarehouses();
		await tamperSlice(db, 2);

		// A peer's merged change lands as a plain row write; simulate with direct SQL on db.
		// 1. Quantity edit on a committed leg.
		await db.exec("UPDATE book_transaction SET quantity = 12 WHERE isbn = '1111111111' AND note_id = 1");
		let res = await refreshStockCache(db);
		expect(res.changed).toBe(true);
		expect(res.warehouseIds).toEqual(new Set([1]));
		expect((await getCachedStock(db)).find((r) => r.isbn === "1111111111")?.quantity).toBe(12);

		// 2. Deletion of a committed leg (no fresh committed_at anywhere — the old gate's blind spot).
		await db.exec("DELETE FROM book_transaction WHERE isbn = '1111111111' AND note_id = 1");
		res = await refreshStockCache(db);
		expect(res.changed).toBe(true);
		expect(res.warehouseIds).toEqual(new Set([1]));
		expect((await getCachedStock(db)).some((r) => r.isbn === "1111111111")).toBe(false);

		// 3. Resurrection: the same primary key comes back.
		await db.exec("INSERT INTO book_transaction (isbn, quantity, note_id, warehouse_id) VALUES ('1111111111', 7, 1, 1)");
		res = await refreshStockCache(db);
		expect(res.changed).toBe(true);
		expect(res.warehouseIds).toEqual(new Set([1]));
		expect((await getCachedStock(db)).find((r) => r.isbn === "1111111111")?.quantity).toBe(7);

		// Warehouse 2 was never refolded throughout.
		expect(await sliceTampered(db, 2)).toBe(true);
		expect(await isStockCacheStale(db)).toBe(false);
	});

	it("catches a sign-affecting note column change on a committed note (defensive: no app path writes this)", async () => {
		const db = await setupTwoWarehouses();

		// Flipping is_reconciliation_note on a committed outbound note would flip its legs' sign.
		await createOutboundNote(db, 10);
		await addVolumesToNote(db, 10, { isbn: "1111111111", quantity: 2, warehouseId: 1 });
		await commitNote(db, 10);
		await refreshStockCache(db);

		await db.exec("UPDATE note SET is_reconciliation_note = 1 WHERE id = 10");
		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([1]));
		expect(await getCachedStock(db)).toEqual(await getStock(db));
	});

	it("catches a peer deleting just the note row (legs become orphans and leave the fold)", async () => {
		const db = await setupTwoWarehouses();

		// A peer deletes note 1 (warehouse 1's committed inbound) WITHOUT deleting its legs — the
		// orphan-leg scenario. The legs survive but the fold's INNER JOIN drops them.
		await db.exec("DELETE FROM note WHERE id = 1");
		const { changed, warehouseIds } = await refreshStockCache(db);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([1]));
		const stock = await getCachedStock(db);
		expect(stock.some((r) => r.warehouseId === 1)).toBe(false);
		expect(stock).toEqual(await getStock(db));
	});

	it("does not register warehouse metadata changes (rename/discount) at all — but a fresh read reflects them", async () => {
		const db = await setupTwoWarehouses();
		await tamperSlice(db, 1);
		await tamperSlice(db, 2);

		// The fold never reads the warehouse table; name/discount are joined live at read time, and
		// the one page that bakes them into state overlays them from its own (watched) warehouse
		// query. So a metadata edit is a non-event for the cache...
		await upsertWarehouse(db, { id: 2, displayName: "Renamed", discount: 25 });
		expect(await isStockCacheStale(db)).toBe(false);
		const { changed } = await refreshStockCache(db);
		expect(changed).toBe(false);
		expect(await sliceTampered(db, 1)).toBe(true);
		expect(await sliceTampered(db, 2)).toBe(true);

		// ...while any read naturally serves the fresh metadata (live join), identical to getStock.
		await rebuildStockCache(db); // clear the markers
		const stock = await getCachedStock(db);
		expect(stock.find((r) => r.warehouseId === 2)).toMatchObject({ warehouseName: "Renamed", warehouseDiscount: 25 });
		expect(stock).toEqual(await getStock(db));
	});

	it("attributes synced (merged) changes to the right warehouses", async () => {
		const [db1, db2] = await getRandomDbs();

		// Shared baseline: both warehouses' stock lives on both nodes.
		await upsertWarehouse(db1, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db1, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db1, 1, 1);
		await addVolumesToNote(db1, 1, { isbn: "1111111111", quantity: 10, warehouseId: 1 });
		await commitNote(db1, 1);
		await createInboundNote(db1, 2, 2);
		await addVolumesToNote(db1, 2, { isbn: "2222222222", quantity: 20, warehouseId: 2 });
		await commitNote(db1, 2);
		await syncDBs(db1, db2);
		await getCachedStock(db2);
		await tamperSlice(db2, 1);

		// db1 commits into warehouse 2 only; db2 merges it.
		await createInboundNote(db1, 2, 3);
		await addVolumesToNote(db1, 3, { isbn: "2222222222", quantity: 5, warehouseId: 2 });
		await commitNote(db1, 3);
		await syncDBs(db1, db2);

		const { changed, warehouseIds } = await refreshStockCache(db2);
		expect(changed).toBe(true);
		expect(warehouseIds).toEqual(new Set([2]));
		expect(await sliceTampered(db2, 1)).toBe(true); // warehouse 1's slice untouched
		expect((await getCachedStock(db2)).find((r) => r.isbn === "2222222222")?.quantity).toBe(25);
	});
});

describe("cr-sqlite internals contract (pinned)", () => {
	// The change scans read cr-sqlite's internal clock + pk-lookaside tables. Their shape is an
	// implementation detail of the vendored cr-sqlite (0.16.x) — this suite pins the parts we rely
	// on so a future vendor bump that reshapes them fails HERE, loudly, instead of silently
	// degrading the cache to full rebuilds (the runtime falls back to a full rebuild on scan errors,
	// so even unpinned drift costs performance, not correctness).
	it("clock + pks tables have the expected shape and db_version index", async () => {
		const db = await getRandomDb();

		const clockCols = await db.execA<[string]>(`SELECT name FROM pragma_table_info('book_transaction__crsql_clock')`);
		expect(clockCols.map(([c]) => c).sort()).toEqual(["col_name", "col_version", "db_version", "key", "seq", "site_id"]);

		const pksCols = await db.execA<[string]>(`SELECT name FROM pragma_table_info('book_transaction__crsql_pks')`);
		expect(pksCols.map(([c]) => c).sort()).toEqual(["__crsql_key", "isbn", "note_id", "warehouse_id"]);

		const [[indexCount]] = await db.execA<[number]>(
			`SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'book_transaction__crsql_clock_dbv_idx'`
		);
		expect(indexCount).toBe(1);

		for (const table of ["note", "warehouse"]) {
			const [[count]] = await db.execA<[number]>(
				`SELECT COUNT(*) FROM sqlite_master WHERE name IN ('${table}__crsql_clock', '${table}__crsql_pks')`
			);
			expect(count).toBe(2);
		}
	});

	it("insert/update/delete/pk-move write the clock rows the scans rely on", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 5, displayName: "W5" });
		await createOutboundNote(db, 1);

		const changesSince = (version: number | bigint) =>
			db.execO<{ col_name: string; db_version: number; warehouse_id: number }>(
				`SELECT c.col_name, c.db_version, p.warehouse_id
				 FROM "book_transaction__crsql_clock" c
				 JOIN "book_transaction__crsql_pks" p ON p.__crsql_key = c.key
				 WHERE c.db_version > ?
				 ORDER BY c.db_version, c.col_name`,
				[version]
			);

		// INSERT writes a clock row per non-pk column — 'quantity' always among them.
		let version = await getDBVersion(db);
		await addVolumesToNote(db, 1, { isbn: "111", quantity: 3, warehouseId: 5 });
		expect((await changesSince(version)).some((r) => r.col_name === "quantity" && r.warehouse_id === 5)).toBe(true);

		// A pk UPDATE (the deleteWarehouse reassign path) sentinels BOTH the old and the new pk.
		version = await getDBVersion(db);
		await db.exec("UPDATE book_transaction SET warehouse_id = 0 WHERE warehouse_id = 5");
		const moveRows = await changesSince(version);
		expect(
			moveRows
				.filter((r) => r.col_name === "-1")
				.map((r) => r.warehouse_id)
				.sort()
		).toEqual([0, 5]);

		// DELETE leaves a '-1' sentinel at a fresh db_version, and the pks row outlives the deletion
		// (tombstones stay attributable to their warehouse).
		version = await getDBVersion(db);
		await db.exec("DELETE FROM book_transaction WHERE isbn = '111'");
		const delRows = await changesSince(version);
		expect(delRows).toEqual([expect.objectContaining({ col_name: "-1", warehouse_id: 0 })]);
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

	it("re-activating over a fresh snapshot is silent (no event), with the same db handle", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);
		disableRefresh();

		const events: (Set<number> | null)[] = [];
		const off = onInvalidated((ids) => events.push(ids));
		let emissions = 0;
		const unsub = stockByWarehouse.subscribe(() => emissions++); // fires once on subscription
		const baseline = emissions;

		// Same db, still-valid published value: no republish, no notification, no reload churn.
		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);
		expect(events).toEqual([]);
		expect(emissions).toBe(baseline); // the published query was NOT replaced
		unsub();
		off();
	});

	it("a forced invalidate() with nothing relevant changed republishes silently and re-validates", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);

		const events: (Set<number> | null)[] = [];
		const off = onInvalidated((ids) => events.push(ids));

		// e.g. the warehouses page calls invalidate() after a deleteWarehouse that turns out to be a
		// no-op for stock. The fresh promise must resolve (consumers await it) without any event
		// (no reload loop), and the cache must read as valid again.
		invalidate();
		await waitForWarehouseTotal(1, 7);
		expect(events).toEqual([]);

		// Valid again: another enableRefresh must NOT republish (counted via store emissions).
		let emissions = 0;
		const unsub = stockByWarehouse.subscribe(() => emissions++); // fires once on subscription
		const baseline = emissions;
		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);
		expect(events).toEqual([]);
		expect(emissions).toBe(baseline);
		unsub();
		off();
	});

	it("republishes on a db swap even though the previous published value was still valid", async () => {
		// A nuke-and-resync (or db selection change) replaces the handle in place, with no reload and
		// no change events on the new db — the swap itself must invalidate the published value.
		const [dbA, dbB] = await getRandomDbs();
		await upsertWarehouse(dbA, { id: 1, displayName: "Warehouse A" });
		await createInboundNote(dbA, 1, 1);
		await addVolumesToNote(dbA, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(dbA, 1);
		await upsertWarehouse(dbB, { id: 1, displayName: "Warehouse B" });
		await createInboundNote(dbB, 1, 1);
		await addVolumesToNote(dbB, 1, { isbn: "1111111111", quantity: 4, warehouseId: 1 });
		await commitNote(dbB, 1);

		enableRefresh(dbA);
		await waitForWarehouseTotal(1, 7);
		disableRefresh();

		// NO invalidate() in between: if the swap didn't flip `valid`, this would keep serving dbA's
		// totals and hang waiting for dbB's.
		enableRefresh(dbB);
		await waitForWarehouseTotal(1, 4);
	});

	it("delivers the invalidation even if the cache is deactivated while the refresh is in flight", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);

		const events: (Set<number> | null)[] = [];
		const off = onInvalidated((ids) => events.push(ids));

		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 2);

		// maybeInvalidate launches the refresh; deactivating before it resolves must NOT swallow the
		// notification — the refold durably advances the shared watermark, so a later refresh would
		// report changed=false and the event would be lost for good.
		await maybeInvalidate(db);
		disableRefresh();
		await waitForWarehouseTotal(1, 10);
		expect(events).toEqual([new Set([1])]);
		off();
	});

	it("detects another tab's refold of the shared snapshot (published value behind a fresh snapshot)", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);

		const events: (Set<number> | null)[] = [];
		const off = onInvalidated((ids) => events.push(ids));

		// A change lands...
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 2);

		// ...and ANOTHER TAB's refresh refolds the shared snapshot before this tab's check runs (all
		// tabs share one worker db, one stock_cache and one watermark; this store knows nothing).
		await refreshStockCache(db);
		// The trap: the snapshot itself now reads fresh — only the published-version comparison can
		// tell this tab its VALUE is behind.
		expect(await isStockCacheStale(db)).toBe(false);

		await maybeInvalidate(db);
		await waitForWarehouseTotal(1, 10);
		// The other tab's refresh consumed the attribution, so the payload degrades to null.
		expect(events).toEqual([null]);
		off();
	});

	it("a refresh resolving after disableRefresh must not validate the cache (supersession guard)", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		// Kick a refresh and deactivate before it can resolve. The published promise still resolves
		// (its consumers expect a value) but must NOT mark the cache valid — the activation that
		// observes its result is gone, and changes may land before the next one.
		enableRefresh(db);
		disableRefresh();
		await waitForWarehouseTotal(1, 7);

		// A change lands while inactive; deliberately NO maybeInvalidate (the point is that `valid`
		// must already be false thanks to the guard).
		await createInboundNote(db, 1, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 3, warehouseId: 1 });
		await commitNote(db, 2);

		// If the orphaned resolution had set valid=true, this enableRefresh would skip republishing
		// and the totals would stay at 7 forever.
		enableRefresh(db);
		await waitForWarehouseTotal(1, 10);
	});

	it("does NOT notify subscribers for stock-irrelevant writes (no UI churn)", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);

		const events: (Set<number> | null)[] = [];
		const off = onInvalidated((ids) => events.push(ids));

		// Draft-note editing + unrelated writes: maybeInvalidate must not see anything relevant.
		await createOutboundNote(db, 2);
		await addVolumesToNote(db, 2, { isbn: "1111111111", quantity: 1, warehouseId: 1 });
		await upsertBook(db, { isbn: "1111111111", title: "Retitled" });
		await maybeInvalidate(db);
		// Settle any (would-be) refresh before asserting.
		await waitForWarehouseTotal(1, 7);
		expect(events).toEqual([]);
		off();
	});

	it("notifies subscribers with exactly the affected warehouses (the [id]-page filtering contract)", async () => {
		const db = await getRandomDb();
		await upsertWarehouse(db, { id: 1, displayName: "Warehouse 1" });
		await upsertWarehouse(db, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db, 1, 1);
		await addVolumesToNote(db, 1, { isbn: "1111111111", quantity: 7, warehouseId: 1 });
		await commitNote(db, 1);

		enableRefresh(db);
		await waitForWarehouseTotal(1, 7);

		const events: (Set<number> | null)[] = [];
		const off = onInvalidated((ids) => events.push(ids));

		// Commit into warehouse 2 only.
		await createInboundNote(db, 2, 2);
		await addVolumesToNote(db, 2, { isbn: "2222222222", quantity: 5, warehouseId: 2 });
		await commitNote(db, 2);
		await maybeInvalidate(db);
		await waitForWarehouseTotal(2, 5);

		expect(events).toEqual([new Set([2])]);

		// A warehouse-1-scoped consumer (the [id] page) would have ignored this event.
		expect(events.every((ids) => ids !== null && !ids.has(1))).toBe(true);
		off();
	});

	// The production bug class (D-217 / #1249): a commit synced in from a lagging or clock-skewed peer
	// carries a committed_at below the local wall-clock watermark. The old gate missed it and the
	// connected node showed permanently-stale (too-low) stock. End-to-end via the public store API.
	it("refreshes totals (and fires onInvalidated with the warehouse) on a synced-in, clock-skewed peer commit", async () => {
		const [db1, db2] = await getRandomDbs();

		// db2: its own committed stock with a HIGH wall-clock committed_at, plus an active, built cache.
		await upsertWarehouse(db2, { id: 2, displayName: "Warehouse 2" });
		await createInboundNote(db2, 2, 1);
		await addVolumesToNote(db2, 1, { isbn: "2222222222", quantity: 4, warehouseId: 2 });
		await commitNote(db2, 1);

		enableRefresh(db2);
		await waitForWarehouseTotal(2, 4);

		const events: (Set<number> | null)[] = [];
		const off = onInvalidated((ids) => events.push(ids));

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
		expect(events.length).toBeGreaterThan(0);
		expect(events.every((ids) => ids === null || ids.has(2))).toBe(true);
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
