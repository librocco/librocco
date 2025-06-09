import { writable, get, derived } from "svelte/store";

import type { DB, GetStockResponseItem } from "$lib/db/cr-sqlite/types";

import { getStock } from "$lib/db/cr-sqlite/stock";
import { reduce, wrapIter } from "@librocco/shared";
import { timed } from "$lib/utils/timer";

const dbStore = writable<DB | null>(null);
const valid = writable(false);
const cacheTimestamp = writable(0);

/**
 * Executes the stock query and sets the cache as valid (upon resolution)
 */
const execQuery = async (db: DB) => {
	const stock = await getStock(db);
	const [[timestamp]] = await db.execA<[number]>("SELECT COALESCE(MAX(committed_at), 0) FROM book_transaction");
	valid.set(true);
	cacheTimestamp.set(timestamp);
	return stock;
};

/**
 * An internal store keeping the full stock query as a promise
 * NOTE: This is somewhat lazy - the initial promise never resolves, but it doesn't
 * choke up the DB either. Only when the cached stock is activated (needed by a consumer), does it
 * run the query.
 *
 * This is a tradeoff between prefetching the results and not blocking other DB interactions until the stock is needed.
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

export const enableRefresh = (db: DB) => {
	// Set the DB -- effectively enabling the cache
	dbStore.set(db);

	// If cache invalidated while not active, rerun the query
	if (!get(valid)) {
		query.set(execQuery(db));
	}
};

export const disableRefresh = () => dbStore.set(null);

export const invalidate = () => {
	// Invalidate the cache
	valid.set(false);

	const db = get(dbStore);

	// If currently active, rerun the query
	if (db) {
		query.set(execQuery(db));
	}
};

async function _countRelevantUpdates(db: DB, cacheTimestamp: number) {
	// Count the number of updates that are relevant to the stock calculation
	const [[res]] = await db.execA<[number]>("SELECT COUNT(*) FROM book_transaction WHERE committed_at > ?", [cacheTimestamp]);
	return res;
}
const countRelevantUpdates = timed(_countRelevantUpdates);

/**
 * We run a intermediate (cheap) query to check if the observed updates affect the stock calculation:
 * - if so, we invalidate the cache (which will then may, or may not, re-execute the, expensive stock query - depending on the cache being active)
 * - if not, noop
 *
 */
export const maybeInvalidate = async (db: DB) => {
	const numUpdates = await countRelevantUpdates(db, get(cacheTimestamp));
	if (numUpdates > 0) {
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
