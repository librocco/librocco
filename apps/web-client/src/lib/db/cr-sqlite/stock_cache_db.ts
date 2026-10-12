/**
 * @fileoverview Persistent, local-only materialisation of the stock fold, with per-warehouse,
 * event-filtered invalidation.
 *
 * `getStock()` (stock.ts) recomputes warehouse quantities by folding the entire committed
 * `book_transaction` history on every call. That cost grows with total history and is paid again on
 * every cold start. This module persists the fold into a local table so it survives reloads/restarts,
 * and recomputes only the warehouses whose stock-relevant data actually changed.
 *
 * Correctness contract — "only improve, never degrade":
 *
 *  1. The materialised table is a pure, *local* derivation of the synced base tables. It is NEVER
 *     `crsql_as_crr`'d and never synced. Syncing a derived aggregate would last-write-wins-merge the
 *     summed quantities across sites and diverge; instead each device rebuilds it locally from its own
 *     replica.
 *
 *  2. Staleness is decided against the cr-sqlite logical clock, never a wall clock. The snapshot
 *     carries the `crsql_db_version()` watermark it was computed at, and change *attribution* reads
 *     cr-sqlite's own per-table clock tables (`<tbl>__crsql_clock`, joined to the `<tbl>__crsql_pks`
 *     pk-lookaside). Those clocks are the foundation of sync itself: every mutation of a CRR — local
 *     write, merged remote change, delete (tombstone sentinel `col_name = '-1'`), even a primary-key
 *     move (delete-sentinel for the old pk + create-sentinel for the new) — lands a clock row with a
 *     fresh, monotonically increasing `db_version`. Nothing can slip under the watermark the way
 *     out-of-order or clock-skewed `committed_at` values could (the previous design's failure mode).
 *
 *  3. The scans are *filtered supersets* of the fold's true inputs: only stock-relevant columns are
 *     watched, draft-note editing noise is provably skippable and skipped, and row-lifecycle
 *     sentinels ('-1') ALWAYS count — a tombstone may no longer be judgeable (ids get recycled), and
 *     when attribution is in doubt the change counts as relevant. See the per-scan comments for the
 *     exact rules and why each is sound. If the scan itself fails (e.g. a future cr-sqlite upgrade
 *     reshapes its internals) we fall back to a full rebuild — an internals change can cost
 *     performance, never correctness.
 *
 *  4. Because the cache tables are NOT CRRs, writing them does not create clock rows and so does not
 *     bump `crsql_db_version()`. Rebuilding the cache therefore cannot invalidate itself.
 *
 *  5. The tables live outside `schemas/init` (the synced schema, whose content hash gates sync
 *     compatibility between peers), so introducing them neither bumps the schema version nor breaks
 *     sync. They are created lazily at runtime and are self-healing: cr-sqlite's automigrate drops
 *     tables it doesn't recognise, so should a future schema migration run, they are dropped and
 *     simply recreated + repopulated on next access.
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
 * - `stock_cache_meta`: a single row holding the `crsql_db_version()` watermark the snapshot
 *                       reflects: every stock-relevant change at or below it is folded in.
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
	CREATE INDEX IF NOT EXISTS stock_cache_warehouse_idx ON stock_cache (warehouse_id);
	CREATE TABLE IF NOT EXISTS stock_cache_meta (
		id INTEGER PRIMARY KEY CHECK (id = 0),
		db_version INTEGER NOT NULL
	);
`;

// Signed quantity per transaction: positive for inbound/reconciliation, negative for outbound.
// Kept byte-for-byte in sync with the expression in stock.ts::_getStock so the materialised aggregate
// is identical to the live fold.
const SIGNED_QUANTITY = `CASE WHEN n.warehouse_id IS NOT NULL OR n.is_reconciliation_note = 1 THEN bt.quantity ELSE -bt.quantity END`;

// The fold, optionally restricted to a set of warehouses. GROUP BY (isbn, warehouse_id) makes the
// fold warehouse-separable: folding one warehouse's slice yields exactly that slice of the full fold,
// so partial rebuilds and the full rebuild can share this one statement.
const rebuildInsertSql = (warehouseCount?: number) => `
	INSERT INTO stock_cache (isbn, warehouse_id, quantity)
	SELECT
		bt.isbn,
		bt.warehouse_id,
		SUM(${SIGNED_QUANTITY}) AS quantity
	FROM book_transaction bt
	JOIN note n ON bt.note_id = n.id
	WHERE n.committed = 1${warehouseCount ? ` AND bt.warehouse_id IN (${Array(warehouseCount).fill("?").join(", ")})` : ""}
	GROUP BY bt.isbn, bt.warehouse_id
	HAVING SUM(${SIGNED_QUANTITY}) != 0
`;

/**
 * Change scans — the heart of the event filtering. Each scan reads one base table's cr-sqlite clock
 * (every cell-level change since the watermark, indexed on db_version) joined to its pk-lookaside
 * (which outlives row deletion, so tombstones stay attributable) and returns the DISTINCT warehouses
 * whose fold inputs changed.
 *
 * Verified against the shipped crsqlite-wasm 0.16.x (and pinned by the internals test):
 * - an INSERT writes a clock row for every non-pk column (so `quantity` always appears);
 * - an UPDATE writes clock rows for the touched columns only;
 * - a DELETE leaves a `col_name = '-1'` sentinel at a fresh db_version;
 * - a pk UPDATE (e.g. deleteWarehouse's `SET warehouse_id = 0`) sentinels BOTH the old and new pk.
 */

// book_transaction: `quantity` is the only non-pk column the fold reads; '-1' covers row
// create/delete/pk-move sentinels.
//
// `quantity` changes on legs of an uncommitted (draft) note don't alter stock, so they're gated on
// the parent note's CURRENT committed state — a missing note counts as relevant. (If the draft
// commits later, that's a `note.committed` change caught by the note scan below.)
//
// '-1' sentinels are NOT gated: note ids are recycled (getNoteIdSeq is MAX(id)+1), so a tombstone's
// note_id can resolve to a *different, later* note — e.g. deleteWarehouse removes a committed note,
// the id is reborn as somebody's draft, and the gate would judge the old committed legs' tombstones
// against the new draft and silently skip the refold, leaving phantom stock forever. A lifecycle
// event always dirties its pk's warehouse; the cost is a value-identical refold when a draft line
// is removed or moved between warehouses (click-frequency, not keystroke-frequency).
const TXN_SCAN = `
	SELECT DISTINCT p.warehouse_id
	FROM "book_transaction__crsql_clock" c
	JOIN "book_transaction__crsql_pks" p ON p.__crsql_key = c.key
	LEFT JOIN note n ON n.id = p.note_id
	WHERE c.db_version > ?
		AND (c.col_name = '-1' OR (c.col_name = 'quantity' AND COALESCE(n.committed, 1) = 1))
`;

// note: `committed` flips legs in/out of the fold; `warehouse_id`/`is_reconciliation_note` flip the
// SIGNED_QUANTITY sign; '-1' covers note deletion (its legs leave the fold even if they survive as
// orphans — the fold's INNER JOIN drops them) and resurrection. Affected warehouses are the note's
// legs' warehouses.
//
// Two deliberate choices:
// - NO committed-state gate: a committed-state TRANSITION is exactly the change the current state
//   cannot witness (gating the txn scan's `quantity` rows on `committed` is only sound because this
//   scan catches every transition — judging transitions by the current value would be circular, and
//   `committed` is only app-monotonic: remediation SQL can flip it back).
// - `col_version > 1` for the column rows: an INSERT writes a clock row for every column (a draft
//   note's creation emits committed=0/warehouse_id/is_reconciliation_note rows), but a row's
//   *initial* state only affects stock through its legs, which the txn scan owns (a reconciliation
//   note born committed=1 registers through its legs' `quantity` rows). Only post-creation changes
//   (col_version 2+, preserved by LWW merge from the sender) matter at the note level. This keeps
//   draft-note creation entirely silent.
const NOTE_SCAN = `
	SELECT DISTINCT bt.warehouse_id
	FROM (
		SELECT DISTINCT p.id
		FROM "note__crsql_clock" c
		JOIN "note__crsql_pks" p ON p.__crsql_key = c.key
		WHERE c.db_version > ?
			AND (
				c.col_name = '-1'
				OR (c.col_name IN ('committed', 'warehouse_id', 'is_reconciliation_note') AND c.col_version > 1)
			)
	) dirty_note
	JOIN book_transaction bt ON bt.note_id = dirty_note.id
`;

// NOTE: the `warehouse` table is deliberately NOT scanned. The fold never reads it (quantities are
// keyed by bt.warehouse_id), and the read output's warehouseName/warehouseDiscount are joined live —
// the one consumer that bakes them into page state (the warehouse [id] page) sources them from its
// own `warehouse:data` load, which has its own change watcher. A warehouse DELETION is caught via
// its legs' tombstones (see deleteWarehouse), not via the warehouse row.

// Reads the materialised aggregate and re-joins book/warehouse metadata *live* (cheap, indexed) so the
// snapshot never has to be rebuilt for a title/price/discount edit. Projection is identical to
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

/**
 * Result of bringing the snapshot up to date.
 * - `changed: false` — nothing stock-relevant happened; the published value is still exact.
 * - `changed: true, warehouseIds: Set` — only these warehouses' rows (or their live-joined warehouse
 *   metadata) changed.
 * - `changed: true, warehouseIds: null` — full rebuild (first build, self-heal, or scan-failure
 *   fallback); treat as "anything may have changed".
 *
 * `version` / `previousVersion` are the snapshot's watermark after and before this refresh. They let
 * a caller that REMEMBERS the version of the value it last served detect that the snapshot moved
 * past it through someone else's refresh: in multi-tab operation all tabs share one db (and so one
 * snapshot + watermark), so the refold — and its `changed: true` — happens in whichever tab's
 * refresh wins; the other tabs see `changed: false` and must compare versions instead.
 * `previousVersion: null` means there was no (trustworthy) prior snapshot.
 */
export type StockCacheRefreshResult = {
	changed: boolean;
	warehouseIds: Set<number> | null;
	version: number;
	previousVersion: number | null;
};

/** Create the local cache tables if they don't yet exist. Idempotent and cheap. */
export async function ensureStockCacheTable(db: TXAsync): Promise<void> {
	await db.exec(STOCK_CACHE_DDL);
}

const getWatermark = async (db: TXAsync): Promise<number | null> => {
	const res = await db.execA<[number]>("SELECT db_version FROM stock_cache_meta WHERE id = 0");
	return res.length ? res[0][0] : null;
};

/**
 * The snapshot's current watermark (or null if no snapshot exists). Cheap single-row read, exposed
 * so the store layer can compare the version of its published value against the shared snapshot —
 * see StockCacheRefreshResult on why `changed` alone can't carry that information across tabs.
 */
export async function getStockCacheVersion(db: TXAsync): Promise<number | null> {
	await ensureStockCacheTable(db);
	return getWatermark(db);
}

const getCurrentVersion = async (db: TXAsync): Promise<number> => (await db.execA<[number]>("SELECT crsql_db_version()"))[0][0];

/**
 * Recompute the snapshot from the base tables and stamp it with the current logical version.
 * The DELETE + INSERT + watermark stamp run in a single transaction so a reader never observes a
 * partial rebuild and the stored version always matches the data it labels. The version is read
 * *inside* the transaction; since the cache tables are non-CRR, the writes here don't move it, so the
 * stamp equals the version the fold reflects.
 */
async function _rebuildStockCache(db: DBAsync): Promise<void> {
	await ensureStockCacheTable(db);
	await db.tx(async (tx) => {
		await tx.exec("DELETE FROM stock_cache");
		await tx.exec(rebuildInsertSql());
		await tx.exec("INSERT OR REPLACE INTO stock_cache_meta (id, db_version) VALUES (0, crsql_db_version())");
	});
}
export const rebuildStockCache = timed(_rebuildStockCache);

/**
 * Past this many pending clock rows in either scanned table, per-warehouse attribution is skipped
 * and the refresh takes the full-rebuild path instead: with a huge backlog (initial sync, first
 * refresh after a bulk merge) the attribution scans cost as much as the fold itself, and the dirty
 * set degenerates towards "all warehouses" anyway.
 */
const ATTRIBUTION_LIMIT = 20_000;

const backlogExceeds = async (tx: TXAsync, table: string, watermark: number, limit: number): Promise<boolean> => {
	// The covering db_version index makes this a cheap range probe regardless of backlog size.
	const res = await tx.execA<[number]>(`SELECT 1 FROM "${table}__crsql_clock" WHERE db_version > ? LIMIT 1 OFFSET ?`, [watermark, limit]);
	return res.length > 0;
};

/**
 * Bring the snapshot up to date with the minimum necessary work, and report what changed:
 *
 * 1. No snapshot yet (first run, or the tables were dropped by a migration) → full rebuild.
 *    Likewise if the watermark is somehow AHEAD of the live clock (a clock regression — e.g. cache
 *    tables surviving some future db-replacement path): the watermark can't be trusted, rebuild.
 * 2. Logical clock unmoved → nothing whatsoever happened; serve as is.
 * 3. Otherwise scan the clocks of the fold-relevant tables (book_transaction, note) for changes
 *    since the watermark and refold ONLY the affected warehouses' slices (delete + re-insert just
 *    those), advance the watermark to the current version, and report the affected set.
 *    A scan finding nothing relevant still advances the watermark (keeping future scans short) and
 *    reports `changed: false`. A backlog too large to be worth attributing falls back to a full
 *    rebuild (see ATTRIBUTION_LIMIT).
 *
 * Any error in the scan path (e.g. cr-sqlite internals reshaped by an upgrade) falls back to a full
 * rebuild: coarser, never incorrect. The failure is latched for the session (see scanFailureLatched).
 */
async function _refreshStockCache(db: DBAsync, attributionLimit = ATTRIBUTION_LIMIT): Promise<StockCacheRefreshResult> {
	await ensureStockCacheTable(db);
	try {
		let result!: StockCacheRefreshResult;
		await db.tx(async (tx) => {
			const fullRebuild = async (previousVersion: number | null) => {
				await tx.exec("DELETE FROM stock_cache");
				await tx.exec(rebuildInsertSql());
				await tx.exec("INSERT OR REPLACE INTO stock_cache_meta (id, db_version) VALUES (0, crsql_db_version())");
				const version = (await getWatermark(tx)) ?? 0;
				result = { changed: true, warehouseIds: null, version, previousVersion };
			};

			const watermark = await getWatermark(tx);
			if (watermark === null) return fullRebuild(null);

			const current = await getCurrentVersion(tx);
			// A watermark ahead of the live clock can't be trusted (nor compared against) — treat as no snapshot.
			if (current < watermark) return fullRebuild(null);
			if (current === watermark) {
				result = { changed: false, warehouseIds: new Set(), version: watermark, previousVersion: watermark };
				return;
			}

			if (
				scanFailureLatched ||
				(await backlogExceeds(tx, "book_transaction", watermark, attributionLimit)) ||
				(await backlogExceeds(tx, "note", watermark, attributionLimit))
			) {
				return fullRebuild(watermark);
			}

			const txnRows = await tx.execA<[number]>(TXN_SCAN, [watermark]);
			const noteRows = await tx.execA<[number]>(NOTE_SCAN, [watermark]);

			const foldDirty = new Set([...txnRows, ...noteRows].map(([id]) => id));
			if (foldDirty.size) {
				const ids = [...foldDirty];
				const placeholders = ids.map(() => "?").join(", ");
				await tx.exec(`DELETE FROM stock_cache WHERE warehouse_id IN (${placeholders})`, ids);
				await tx.exec(rebuildInsertSql(ids.length), ids);
			}
			await tx.exec("UPDATE stock_cache_meta SET db_version = ? WHERE id = 0", [current]);

			result = { changed: foldDirty.size > 0, warehouseIds: foldDirty, version: current, previousVersion: watermark };
		});
		return result;
	} catch (err) {
		latchScanFailure(err);
		await _rebuildStockCache(db);
		const version = (await getStockCacheVersion(db)) ?? 0;
		return { changed: true, warehouseIds: null, version, previousVersion: null };
	}
}
export const refreshStockCache = timed(_refreshStockCache);

/**
 * Once any scan fails, stop trying for the rest of the session: the likely cause (cr-sqlite
 * internals reshaped by an upgrade) won't heal until the code is fixed, and retrying would fail —
 * and warn — on every change event. Latched, the cache degrades to exactly the coarse-but-correct
 * pre-attribution behavior (any clock movement → full rebuild). One loud error, not endless noise,
 * so the (performance-only) regression is discoverable in the field.
 */
let scanFailureLatched = false;
const latchScanFailure = (err: unknown) => {
	if (scanFailureLatched) return;
	scanFailureLatched = true;
	console.error(
		"stock_cache: change-attribution scan failed; falling back to full rebuilds for this session (correctness unaffected)",
		err
	);
};

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
 * Versions proven clean by a previous peek, per db handle. Purely an in-memory fast-forward: a peek
 * that finds nothing relevant in (watermark, v] need not rescan that range on the next event — and
 * with the persisted watermark only advancing on refresh, noise rows (draft edits) would otherwise
 * be rescanned on every debounced change event for as long as no stock page is open. Never
 * persisted, so it resets to the (always-safe) persisted watermark on reload; keyed by handle so a
 * version from one db can never be applied to another.
 */
const cleanThrough = new WeakMap<TXAsync, number>();

/**
 * Read-only staleness check: is there any stock-relevant change since the snapshot's watermark?
 * Used by the store's `maybeInvalidate` so an *inactive* cache can flag itself stale without doing
 * any rebuild work. Errs on the side of stale (missing snapshot, clock regression and scan failure
 * all read as stale).
 */
async function _isStockCacheStale(db: TXAsync): Promise<boolean> {
	await ensureStockCacheTable(db);
	try {
		const watermark = await getWatermark(db);
		if (watermark === null) return true;
		const current = await getCurrentVersion(db);
		if (current < watermark) return true;
		// Degraded mode (a scan failed earlier this session): any clock movement counts as stale.
		if (scanFailureLatched) return current !== watermark;
		const since = Math.max(watermark, cleanThrough.get(db) ?? watermark);
		if (current === since) return false;
		const [[stale]] = await db.execA<[number]>(
			`SELECT EXISTS (SELECT 1 FROM (${TXN_SCAN} LIMIT 1)) OR EXISTS (SELECT 1 FROM (${NOTE_SCAN} LIMIT 1))`,
			[since, since]
		);
		// The scans are unbounded above, so anything landing after the `current` read is still seen;
		// caching `current` as clean can therefore never skip a change.
		if (!stale) cleanThrough.set(db, current);
		return !!stale;
	} catch (err) {
		latchScanFailure(err);
		return true;
	}
}
export const isStockCacheStale = _isStockCacheStale;

/**
 * Always-correct read: refresh the stale slices (if any), then read. When nothing relevant has
 * changed this skips the fold entirely and just reads the persisted aggregate — the cold-start win.
 */
async function _getCachedStock(db: DBAsync): Promise<GetStockResponseItem[]> {
	await _refreshStockCache(db);
	return _readStockCache(db);
}
export const getCachedStock = timed(_getCachedStock);
