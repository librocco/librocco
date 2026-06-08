/**
 * @fileoverview Persistent, local-only materialisation of the stock fold.
 *
 * `getStock()` (stock.ts) recomputes warehouse quantities by folding the entire committed
 * `book_transaction` history on every call. That cost grows with total history and is paid again on
 * every cold start. This module persists the fold into a local table so it survives reloads/restarts
 * and only has to be recomputed when the data it depends on has actually changed.
 *
 * Correctness contract — "only improve, never degrade":
 *
 *  1. The materialised table is a pure, *local* derivation of the synced base tables. It is NEVER
 *     `crsql_as_crr`'d and never synced. Syncing a derived aggregate would last-write-wins-merge the
 *     summed quantities across sites and diverge; instead each device rebuilds it locally from its own
 *     replica.
 *
 *  2. The snapshot is tagged with the cr-sqlite logical clock (`crsql_db_version()`) it was computed
 *     at, and is trusted only while the live clock has not moved past that tag. `crsql_db_version()` is
 *     the only *complete* and *monotonic* change signal under CRDT merge: it advances on every local
 *     write AND every merged remote change — inserts, updates, and deletes/tombstones alike. This is
 *     exactly what the previous cache's wall-clock `committed_at` watermark lacked: a lagging or
 *     clock-skewed peer's commit, or a deletion of a committed row, could slip under that watermark and
 *     leave the cache silently stale. The logical clock cannot be slipped under.
 *
 *  3. Because the cache table is NOT a CRR, writing it does not create `__crsql_clock` rows and so does
 *     not bump `crsql_db_version()`. Rebuilding the cache therefore cannot invalidate itself.
 *
 *  4. The table lives outside `schemas/init` (the synced schema, whose content hash gates sync
 *     compatibility between peers), so introducing it neither bumps the schema version nor breaks sync.
 *     It is created lazily at runtime and is self-healing: cr-sqlite's automigrate drops tables it
 *     doesn't recognise, so should a future schema migration run, this table is dropped and simply
 *     recreated + repopulated on next access.
 *
 * The reader is always handed a value equal to what `getStock(db)` would return for the db state the
 * snapshot represents — never a third value. When in doubt we rebuild from the base tables (the source
 * of truth), never trust a stale aggregate.
 */

import type { DBAsync, TXAsync, GetStockResponseItem } from "./types";

import { timed } from "$lib/utils/timer";

/**
 * Local-only (non-CRR) tables backing the materialised stock snapshot.
 * - `stock_cache`:      the per-(isbn, warehouse) signed-quantity aggregate (the expensive fold).
 * - `stock_cache_meta`: a single row holding the `crsql_db_version()` the snapshot was computed at.
 *
 * NOTE: deliberately NOT followed by `crsql_as_crr` — see the file header.
 */
const STOCK_CACHE_DDL = `
	CREATE TABLE IF NOT EXISTS stock_cache (
		isbn TEXT NOT NULL,
		warehouse_id INTEGER NOT NULL,
		quantity INTEGER NOT NULL,
		PRIMARY KEY (isbn, warehouse_id)
	);
	CREATE TABLE IF NOT EXISTS stock_cache_meta (
		id INTEGER PRIMARY KEY CHECK (id = 0),
		db_version INTEGER NOT NULL
	);
`;

// Signed quantity per transaction: positive for inbound/reconciliation, negative for outbound.
// Kept byte-for-byte in sync with the expression in stock.ts::_getStock so the materialised aggregate
// is identical to the live fold.
const SIGNED_QUANTITY = `CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END`;

const REBUILD_INSERT = `
	INSERT INTO stock_cache (isbn, warehouse_id, quantity)
	SELECT
		bt.isbn,
		bt.warehouse_id,
		SUM(${SIGNED_QUANTITY}) AS quantity
	FROM book_transaction bt
	JOIN note n ON bt.note_id = n.id
	WHERE n.committed = 1
	GROUP BY bt.isbn, bt.warehouse_id
	HAVING SUM(${SIGNED_QUANTITY}) != 0
`;

// Reads the materialised aggregate and re-joins book/warehouse metadata *live* (cheap, indexed) so the
// snapshot never has to be invalidated for a title/price/discount edit. Projection is identical to
// stock.ts::_getStock so the two are interchangeable.
const READ_SQL = `
	SELECT
		sc.isbn,
		sc.quantity AS quantity,
		sc.warehouse_id AS warehouseId,
		COALESCE(w.display_name, w.id) AS warehouseName,
		COALESCE(w.discount, 0) AS warehouseDiscount,
		COALESCE(b.title, 'N/A') AS title,
		COALESCE(b.price, 0) AS price,
		COALESCE(b.year, 'N/A') AS year,
		COALESCE(b.authors, 'N/A') AS authors,
		COALESCE(b.publisher, '') AS publisher,
		COALESCE(b.edited_by, '') AS editedBy,
		b.out_of_print,
		COALESCE(b.category, '') AS category
	FROM stock_cache sc
	LEFT JOIN book b ON sc.isbn = b.isbn
	LEFT JOIN warehouse w ON sc.warehouse_id = w.id
	ORDER BY sc.isbn, sc.warehouse_id
`;

/** Create the local cache tables if they don't yet exist. Idempotent and cheap. */
export async function ensureStockCacheTable(db: TXAsync): Promise<void> {
	await db.exec(STOCK_CACHE_DDL);
}

/**
 * Recompute the snapshot from the base tables and stamp it with the current logical version.
 * The DELETE + INSERT + version stamp run in a single transaction so a reader never observes a partial
 * rebuild and the stored version always matches the data it labels. The version is read *inside* the
 * transaction; since the cache tables are non-CRR, the writes above don't move it, so the stamp equals
 * the version the fold reflects.
 */
async function _rebuildStockCache(db: DBAsync): Promise<void> {
	await ensureStockCacheTable(db);
	await db.tx(async (tx) => {
		await tx.exec("DELETE FROM stock_cache");
		await tx.exec(REBUILD_INSERT);
		await tx.exec("INSERT OR REPLACE INTO stock_cache_meta (id, db_version) VALUES (0, crsql_db_version())");
	});
}
export const rebuildStockCache = timed(_rebuildStockCache);

/** Read the materialised snapshot (joining live metadata). Does NOT check staleness. */
async function _readStockCache(db: TXAsync): Promise<GetStockResponseItem[]> {
	await ensureStockCacheTable(db);
	const res = await db.execO<Omit<GetStockResponseItem, "outOfPrint"> & { out_of_print: number }>(READ_SQL);
	return res.map(({ out_of_print, ...rest }) => ({ outOfPrint: !!out_of_print, ...rest }));
}
export const readStockCache = timed(_readStockCache);

/** Whether a snapshot has ever been computed for this db. */
export async function hasStockCacheSnapshot(db: TXAsync): Promise<boolean> {
	await ensureStockCacheTable(db);
	const [[n]] = await db.execA<[number]>("SELECT COUNT(*) FROM stock_cache_meta WHERE id = 0");
	return !!n;
}

/**
 * Whether the live logical clock has moved past the snapshot's tag (or there is no snapshot).
 * This single integer comparison is the entire invalidation decision — complete and monotonic under
 * CRDT merge. A missing snapshot reads as stale (COALESCE to -1 < any version).
 */
async function _isStockCacheStale(db: TXAsync): Promise<boolean> {
	await ensureStockCacheTable(db);
	const [[stale]] = await db.execA<[number]>(
		"SELECT crsql_db_version() > COALESCE((SELECT db_version FROM stock_cache_meta WHERE id = 0), -1)"
	);
	return !!stale;
}
export const isStockCacheStale = _isStockCacheStale;

/**
 * Always-correct read: rebuild from the base tables iff the snapshot is stale (or missing), then read.
 * When nothing relevant has changed since the last snapshot this skips the fold entirely and just reads
 * the persisted aggregate — the cold-start win.
 */
async function _getCachedStock(db: DBAsync): Promise<GetStockResponseItem[]> {
	if (await _isStockCacheStale(db)) {
		await _rebuildStockCache(db);
	}
	return _readStockCache(db);
}
export const getCachedStock = timed(_getCachedStock);
