import { writable, get, derived } from "svelte/store";

import type { TXAsync, GetStockResponseItem } from "$lib/db/cr-sqlite/types";

import { getStock } from "$lib/db/cr-sqlite/stock";
import { getDBVersion } from "$lib/db/cr-sqlite/db";
import { reduce, wrapIter } from "@librocco/shared";
import { timed } from "$lib/utils/timer";

const dbStore = writable<TXAsync | null>(null);
const valid = writable(false);
// Local crsql db_version at the time the cache was last (re)built. cr-sqlite re-stamps applied
// remote changes with the local, monotonically-increasing db_version, so this is a node-safe
// "have I seen everything up to here" watermark (a wall-clock timestamp is not — see maybeInvalidate).
const cacheVersion = writable<bigint>(0n);

/**
 * Executes the stock query and sets the cache as valid (upon resolution)
 */
const execQuery = async (db: TXAsync) => {
	// Capture the watermark BEFORE reading stock: any change applied after this point is strictly
	// greater than `version`, so maybeInvalidate will catch it (at worst a redundant recompute, never
	// a missed one).
	const version = await getDBVersion(db);
	const stock = await getStock(db);
	valid.set(true);
	cacheVersion.set(version);
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

export const enableRefresh = (db: TXAsync) => {
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

async function _countRelevantUpdates(db: TXAsync, cacheVersion: bigint) {
	// Count stock-affecting changes applied since the cache was built, using the local db_version as
	// a logical, node-safe watermark. The stock SUM depends on: committed legs (a leg gets a
	// committed_at written when its note is committed), note.committed flips, and warehouse rows (the
	// stock query JOINs note ON committed = 1 and LEFT JOINs warehouse). Draft scanning only writes a
	// leg's quantity/updated_at — never committed_at — so it does not match here and the (expensive)
	// stock query is not needlessly recomputed.
	//
	// Previously this counted `book_transaction WHERE committed_at > ?` against MAX(committed_at), a
	// per-node WALL CLOCK: a commit synced in from a workstation whose clock was behind (or simply an
	// earlier-but-later-arriving commit) carried a committed_at <= the watermark and never
	// invalidated the cache, leaving permanently stale stock on a connected node.
	const [[res]] = await db.execA<[number]>(
		`SELECT COUNT(*) FROM crsql_changes
		 WHERE db_version > ?
		   AND ( ("table" = 'book_transaction' AND cid = 'committed_at')
		      OR ("table" = 'note' AND cid = 'committed')
		      OR "table" = 'warehouse' )`,
		[cacheVersion]
	);
	return res;
}
const countRelevantUpdates = timed(_countRelevantUpdates);

/**
 * We run a intermediate (cheap) query to check if the observed updates affect the stock calculation:
 * - if so, we invalidate the cache (which will then may, or may not, re-execute the, expensive stock query - depending on the cache being active)
 * - if not, noop
 *
 */
export const maybeInvalidate = async (db: TXAsync) => {
	const numUpdates = await countRelevantUpdates(db, get(cacheVersion));
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
