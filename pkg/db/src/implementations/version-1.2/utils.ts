import { map, StockMap, wrapIter } from "@librocco/shared";

import { VolumeStock } from "@librocco/shared";

import { EntriesStreamResult, NavMap, VolumeStockClient } from "@/types";

type Params = [Iterable<VolumeStock>, { total: number; totalPages: number }, NavMap, ...any[]];
type ParamsWithAvailableWarehouses = [Iterable<VolumeStock>, { total: number; totalPages: number }, NavMap, StockMap];

export function combineTransactionsWarehouses(opts: {
	includeAvailableWarehouses: true;
}): (params: ParamsWithAvailableWarehouses) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }): (params: Params) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }) {
	return opts?.includeAvailableWarehouses
		? ([entries, stats, warehouses, stock]: ParamsWithAvailableWarehouses): EntriesStreamResult => ({
				...stats,
				rows: [...addAvailableWarehouses(addWarehouseNames(entries, warehouses), warehouses, stock)]
		  })
		: ([entries, stats, warehouses]: Params): EntriesStreamResult => ({
				...stats,
				rows: [...addWarehouseNames(entries, warehouses)]
		  });
}

/**
 * Takes in a list of VolumeStock entries and a list of existing warehouses and adds a `warehouseName` field (with respect to warehouseId) to each entry.
 *
 * @param entries
 * @param warehouses
 * @returns
 */
export const addWarehouseNames = (entries: Iterable<VolumeStock>, warehouses: NavMap): Iterable<VolumeStockClient> => {
	return map(entries, (e) => {
		return {
			...e,
			warehouseName: warehouses.get(e.warehouseId)?.displayName || "not-found"
		};
	});
};

/**
 * Takes in a list of VolumeStockClient entries and a list of existing warehouses and adds an `availableWarehouses` field to each entry (omitting the default warehouse).
 *
 * @param entries
 * @param warehouses
 * @returns
 */
export const addAvailableWarehouses = (
	entries: Iterable<VolumeStockClient>,
	warehouses: NavMap,
	stock: StockMap
): Iterable<VolumeStockClient> => {
	return map(entries, (e) => {
		const availableWarehouses: NavMap = new Map(
			wrapIter(stock.isbn(e.isbn)).map(([[, warehouseId]]) => [
				warehouseId,
				warehouses.get(warehouseId) || { displayName: "not-found" }
			])
		);
		return { ...e, availableWarehouses };
	});
};
