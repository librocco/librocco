import { writable, get, derived } from "svelte/store";

import type { DBAsync, GetStockResponseItem } from "$lib/db/cr-sqlite/types";

import { reduce, wrapIter } from "@librocco/shared";

import { getCachedStock, isStockCacheStale } from "$lib/db/cr-sqlite/stock_cache_db";

/**
 * Reactive layer over the persistent stock snapshot (stock_cache_db.ts).
 *
 * The snapshot lives in a local SQLite table and is invalidated by the cr-sqlite logical clock, so it
 * survives reloads and is only recomputed when the data it depends on actually changed. This store is
 * just the Svelte glue that publishes the current stock to the UI and refreshes it.
 *
 * "Only improve, never degrade": when a consumer activates the cache we read the persisted snapshot,
 * recomputing the fold only if the logical clock has moved since it was built (otherwise a cheap read —
 * the cold-start win). Consumers are only ever handed a value equal to what `getStock` would return for
 * some db state. The decision-critical paths (outbound availability, out-of-stock validation)
 * deliberately bypass this cache and fold live; this layer is for display.
 */

const dbStore = writable<DBAsync | null>(null);

/**
 * Whether the currently-published `query` value still reflects the latest known stock.
 *
 * This gate is load-bearing for the consumers' reactive wiring: the warehouse page subscribes to
 * `onInvalidated` (which fires on every `query` change) and reacts by re-running its load, which calls
 * `enableRefresh` again. If `enableRefresh` republished `query` unconditionally it would fire
 * `onInvalidated` on every page load and spin that reload loop forever. So we republish only when the
 * cache is not already valid; a real invalidation (the logical clock moved) is the only thing that
 * flips this back to false.
 */
const valid = writable(false);

/**
 * Read the freshest stock from the persistent cache, rebuilding the snapshot only if the logical clock
 * has moved since it was built. Marks the cache valid once resolved.
 */
const execQuery = async (db: DBAsync) => {
	const stock = await getCachedStock(db);
	valid.set(true);
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

export const enableRefresh = (db: DBAsync) => {
	// Set the DB -- effectively enabling the cache
	dbStore.set(db);

	// Only (re)publish when the cache isn't already valid -- see `valid`. The query itself is cheap when
	// nothing changed (it reads the persisted snapshot rather than refolding), but republishing fires
	// onInvalidated, and consumers react to that by re-running their load -> enableRefresh, which would
	// loop forever.
	if (!get(valid)) {
		query.set(execQuery(db));
	}
};

export const disableRefresh = () => dbStore.set(null);

export const invalidate = () => {
	// Invalidate the cache
	valid.set(false);

	const db = get(dbStore);

	// If currently active, rerun the query (rebuilds the snapshot iff the clock moved, then reads). If
	// not, there's nothing to publish: `valid` is now false, so the next enableRefresh rebuilds.
	if (db) {
		query.set(execQuery(db));
	}
};

/**
 * Cheap gate run on every observed stock-affecting change (local or synced): if the logical clock has
 * moved past the persisted snapshot, invalidate. `invalidate` flips `valid` whether or not a consumer
 * is active, so a change landing while inactive still forces the next enableRefresh to rebuild. If
 * nothing relevant changed, noop.
 */
export const maybeInvalidate = async (db: DBAsync) => {
	if (await isStockCacheStale(db)) {
		invalidate();
	}
};

const onInvalidatedSubscribers = new Set<() => void>();

// Every time a query changes (it had been invalidated), we notify all of the 'onInvalidated' subscribers
// NOTE: We're doint this way, instead of directly subscribing every 'onInvalidated' callback to the query,
// to prevent triggering on subscription (thus preventing flashing UI on init). This way the subscribers are notified
// only on changes in t > t0 (where t0 is the time of subscription)
query.subscribe(() => {
	for (const cb of onInvalidatedSubscribers) {
		cb();
	}
});

export const onInvalidated = (cb: () => void) => {
	onInvalidatedSubscribers.add(cb);
	return () => onInvalidatedSubscribers.delete(cb);
};
