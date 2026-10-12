import { writable, get, derived } from "svelte/store";

import type { DBAsync, GetStockResponseItem } from "$lib/db/cr-sqlite/types";

import { reduce, wrapIter } from "@librocco/shared";

import { refreshStockCache, readStockCache, isStockCacheStale, getStockCacheVersion } from "$lib/db/cr-sqlite/stock_cache_db";

/**
 * Reactive layer over the persistent stock snapshot (stock_cache_db.ts).
 *
 * The snapshot lives in a local SQLite table, invalidated per warehouse by the cr-sqlite logical
 * clock, so it survives reloads and only the affected warehouses are recomputed when stock-relevant
 * data changes. This store is just the Svelte glue that publishes the current stock to the UI,
 * refreshes it, and tells subscribers WHICH warehouses changed so views scoped to one warehouse
 * (the warehouse [id] page) can ignore everyone else's changes.
 *
 * "Only improve, never degrade": when a consumer activates the cache we read the persisted snapshot,
 * refolding only the warehouses the logical clock proves dirty (otherwise a cheap read — the
 * cold-start win). Consumers are only ever handed a value equal to what `getStock` would return for
 * some db state. The decision-critical paths (outbound availability, out-of-stock validation)
 * deliberately bypass this cache and fold live; this layer is for display.
 */

const dbStore = writable<DBAsync | null>(null);

/**
 * Whether the currently-published `query` value still reflects the latest known stock.
 *
 * This gate is load-bearing for the consumers' reactive wiring: the warehouse page subscribes to
 * `onInvalidated` and reacts by re-running its load, which calls `enableRefresh` again. If
 * `enableRefresh` republished (and re-notified) unconditionally it would spin that reload loop
 * forever. So we republish only when the cache is not already valid; a real invalidation (a relevant
 * change observed by `maybeInvalidate`, or a manual `invalidate()`) is the only thing that flips
 * this back to false.
 */
const valid = writable(false);

type InvalidatedCallback = (warehouseIds: Set<number> | null) => void;
const onInvalidatedSubscribers = new Set<InvalidatedCallback>();

/**
 * Notify subscribers that the published stock changed, with the set of affected warehouses
 * (null = "anything may have changed": full rebuild, self-heal or fallback). Fired only when a
 * refresh found actual changes — NOT on every (re)publish — so subscribers' reload wiring can't loop
 * and isn't churned by irrelevant writes.
 */
const notifyInvalidated = (warehouseIds: Set<number> | null) => {
	for (const cb of onInvalidatedSubscribers) {
		cb(warehouseIds);
	}
};

/**
 * The snapshot watermark the currently-published `query` value was computed at, for THIS tab.
 *
 * Load-bearing for multi-tab: all tabs share one db, one persisted snapshot and one watermark, so a
 * refresh's `changed: true` describes the SNAPSHOT and is observed by whichever tab's refresh wins
 * the refold — the others see `changed: false` against the already-advanced watermark. What each tab
 * actually needs to know is whether the snapshot has moved past the value IT is showing, and that is
 * exactly `snapshot version > publishedVersion`. Null = nothing published yet (this tab session).
 */
let publishedVersion: number | null = null;

/**
 * Bring the snapshot up to date (refolding only the dirty warehouses), read it, mark the cache valid
 * and notify subscribers iff the published value moved.
 *
 * The db-identity guard on `valid` protects the singleton state from a stale in-flight query: if the
 * cache was deactivated or re-pointed at a different db while we were querying (tests do this; the
 * app on a db nuke), the result is still returned (the superseded promise's consumers expect a
 * value) but it must not validate the cache — the next enableRefresh has to re-evaluate against the
 * CURRENT db.
 *
 * The notification is NOT identity-gated: it reports a durable fact about the published value (the
 * snapshot moved past it; a later refresh reports `changed: false` and won't re-report), so
 * suppressing it here would lose the event for good. The payload is this refresh's warehouse set
 * only when this refresh's window starts exactly at the previously published version — if other
 * tabs' refolds advanced the snapshot in between, their attribution was delivered to them, not us,
 * so the union is unknown and the payload degrades to null ("anything").
 */
const execQuery = async (db: DBAsync) => {
	const { changed, warehouseIds, version, previousVersion } = await refreshStockCache(db);
	const stock = await readStockCache(db);

	const prevPublished = publishedDb === db ? publishedVersion : null;
	if (publishedDb === db) {
		// Monotonic max: a racing newer refresh may have already recorded a later version.
		publishedVersion = Math.max(publishedVersion ?? -1, version);
	}
	if (get(dbStore) === db) {
		valid.set(true);
	}

	if (prevPublished === null) {
		// First publish of this tab session: whoever triggered it reads the fresh value directly
		// (consumers read the published promise during their load); there is no one to notify yet.
	} else if (previousVersion === null || prevPublished < previousVersion) {
		// The snapshot moved past our published value outside this refresh (another tab's refold, a
		// self-heal, or a fallback rebuild): attribution unknown.
		notifyInvalidated(null);
	} else if (changed) {
		notifyInvalidated(warehouseIds);
	}

	return stock;
};

/**
 * An internal store keeping the current stock query as a promise.
 * NOTE: This is somewhat lazy - the initial promise never resolves, but it doesn't
 * choke up the DB either. Only when the cached stock is activated (needed by a consumer), does it
 * run the query.
 */
const query = writable<Promise<GetStockResponseItem[]>>(new Promise(() => {}));

type StockByWarehouseMap = Map<number, Iterable<GetStockResponseItem>>;
/**
 * A store derived from cached stock query:
 * - it contains a promise which resolves to a Map { warehouseId => Iterable<GetStockResponseItem> }
 * - having a promise allows us to use Svelte's async await block
 * - being a store, it automatically updates when the cache is invalidated
 */
export const stockByWarehouse = derived(
	query,
	($query) => $query.then((stock) => wrapIter(stock)._groupIntoMap((item) => [item.warehouseId, item])) as Promise<StockByWarehouseMap>
);

/**
 * A store derived from cached stock query:
 * - it contains a promise which resolves to a Map { warehouseId => number }
 * - having a promise allows us to use Svelte's async await block
 * - being a store, it automatically updates when the cache is invalidated
 */
export const warehouseTotals = derived(stockByWarehouse, ($stockByWarehouse) =>
	$stockByWarehouse.then(
		(stock) =>
			// Reduce the quantities of items for each warehouse and create a Map { warehouseId => totalQuantiy }
			new Map(wrapIter(stock).map(([warehouseId, items]) => [warehouseId, reduce(items, (acc, { quantity }) => acc + quantity, 0)]))
	)
);

/**
 * The db handle the published `query` value was computed from. Unlike `dbStore` (which flips to null
 * on every disableRefresh, i.e. on every page load), this survives the disable/enable cycle so that
 * re-activating with the SAME db can keep a valid published value, while a db swap/nuke can't keep
 * serving the previous db's snapshot.
 */
let publishedDb: DBAsync | null = null;

export const enableRefresh = (db: DBAsync) => {
	// A different db handle than the one the published value was computed from (first activation, or
	// a db swap/nuke) invalidates whatever is published, no matter how fresh it looked.
	if (publishedDb !== db) {
		valid.set(false);
		publishedDb = db;
		publishedVersion = null;
	}

	// Set the DB -- effectively enabling the cache
	dbStore.set(db);

	// Only (re)publish when the cache isn't already valid -- see `valid`. The query itself is cheap
	// when nothing changed (it reads the persisted snapshot rather than refolding), but consumers
	// react to its notifications by re-running their load -> enableRefresh, which would loop forever.
	if (!get(valid)) {
		query.set(execQuery(db));
	}
};

export const disableRefresh = () => dbStore.set(null);

export const invalidate = () => {
	// Invalidate the cache
	valid.set(false);

	const db = get(dbStore);

	// If currently active, rerun the query (refolds whatever the clock proves dirty, then reads;
	// subscribers are notified with the affected warehouses iff there were any). If not, there's
	// nothing to publish: `valid` is now false, so the next enableRefresh re-evaluates.
	if (db) {
		query.set(execQuery(db));
	}
};

/**
 * Cheap, read-only gate run on every observed change to a stock-relevant table (local or synced): if
 * anything stock-relevant (or warehouse metadata, which the read output joins live) changed since the
 * snapshot's watermark, invalidate. Flips `valid` whether or not a consumer is active, so a change
 * landing while inactive still forces the next enableRefresh to re-evaluate — without doing any
 * rebuild work while inactive. Draft-note edits, note renames and writes to unrelated tables don't
 * register at all: no rebuild, no notification, no UI churn.
 */
export const maybeInvalidate = async (db: DBAsync) => {
	// While inactive AND already flagged stale there is nothing a check could add: invalidate()
	// would only re-set valid=false, and the eventual enableRefresh re-scans from the persisted
	// watermark anyway. Skipping keeps a long catch-up sync (or busy drafting session) on a
	// non-stock page from re-running the staleness scan on every debounced change event.
	// (While ACTIVE we never skip: an in-flight refresh may have read its versions before this
	// event's change landed, so the event must trigger a fresh check.)
	if (!get(dbStore) && !get(valid)) return;

	// Multi-tab: another tab's refresh may have already refolded the shared snapshot past the value
	// THIS tab is showing — then the snapshot itself reads as fresh, but our published value isn't.
	if (publishedDb === db && publishedVersion !== null) {
		const snapshotVersion = await getStockCacheVersion(db);
		if (snapshotVersion !== null && snapshotVersion > publishedVersion) {
			return invalidate();
		}
	}

	if (await isStockCacheStale(db)) {
		invalidate();
	}
};

/**
 * Subscribe to "the published stock changed" events. The callback receives the set of affected
 * warehouse ids, or null when anything may have changed (full rebuild/self-heal/fallback) — treat
 * null as "my warehouse too". Subscribers are NOT called on subscription, only on changes observed
 * after it (prevents flashing UI on init).
 */
export const onInvalidated = (cb: InvalidatedCallback) => {
	onInvalidatedSubscribers.add(cb);
	return () => onInvalidatedSubscribers.delete(cb);
};
