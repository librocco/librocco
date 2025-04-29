import { writable, get, derived } from "svelte/store";

import type { DB, GetStockResponseItem } from "$lib/db/cr-sqlite/types";

import { getStock } from "$lib/db/cr-sqlite/stock";
import { reduce, wrapIter } from "@librocco/shared";

const dbStore = writable<DB | null>(null);
const valid = writable(false);

/**
 * Executes the stock query and sets the cache as valid (upon resolution)
 */
const execQuery = async (db: DB) => {
	const stock = await getStock(db);
	valid.set(true);
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

/**
 * A store derived from cached stock query:
 * - it contains a promise which resolves to a Map { warehouseId => Iterable<GetStockResponseItem> }
 * - having a promise allows us to use Svelte's async await block
 * - being a store, it automatically updates when the cache is invalidated
 */
export const stockByWarehouse = derived(query, ($query) =>
	$query.then((stock) => wrapIter(stock)._groupIntoMap((item) => [item.warehouseId, item]))
);

/**
 * A store derived from cached stock query:
 * - it contains a promise which resolves to a Map { warehouseId => number }
 * - having a promise allows us to use Svelte's async await block
 * - being a store, it automatically updates when the cache is invalidated
 */
export const warehouseTotals = derived(stockByWarehouse, ($stockByWarehouse) =>
	// Wait for the stock by warehouse (effectively stock query)
	$stockByWarehouse.then(
		(stock) =>
			// Reduce the quantities of items for each warehouse and create a Map { warehouseId => totalQuantiy }
			new Map(wrapIter(stock).map(([warehouseId, items]) => [warehouseId, reduce(items, (acc, { quantity }) => acc + quantity, 0)]))
	)
);

export const enable = (db: DB) => {
	// Set the DB -- effectively enabling the cache
	dbStore.set(db);

	// If cache invalidated while not active, rerun the query
	if (!get(valid)) {
		query.set(execQuery(db));
	}
};

export const disable = () => dbStore.set(null);

export const invalidate = () => {
	// Invalidate the cache
	valid.set(false);

	const db = get(dbStore);

	// If currently active, rerun the query
	if (db) {
		query.set(execQuery(db));
	}
};
