import { map, StockMap, wrapIter } from "@librocco/shared";

import { VolumeStock } from "@librocco/shared";

import { EntriesStreamResult, NavMap, VolumeStockClient, WarehouseDataMap } from "@/types";

import { createVersioningFunction } from "@/utils/misc";

export const versionId = createVersioningFunction("v1");

export type TableData = {
	/** Rows to display for a page */
	rows: Iterable<VolumeStock>;
	/** Stats used for pagination */
	stats: {
		total: number;
		totalPages: number;
	};
};

type Params = [TableData, WarehouseDataMap, ...any[]];
type ParamsWithAvailableWarehouses = [TableData, WarehouseDataMap, StockMap];

export function combineTransactionsWarehouses(opts: {
	includeAvailableWarehouses: true;
}): (params: ParamsWithAvailableWarehouses) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }): (params: Params) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }) {
	return opts?.includeAvailableWarehouses
		? ([{ rows, stats }, warehouses, stock]: ParamsWithAvailableWarehouses): EntriesStreamResult => ({
				...stats,
				rows: [...addAvailableWarehouses(addWarehouseData(rows, warehouses), warehouses, stock)]
		  })
		: ([{ rows, stats }, warehouses]: Params): EntriesStreamResult => ({
				...stats,
				rows: [...addWarehouseData(rows, warehouses)]
		  });
}

/**
 * Takes in a list of VolumeStock entries and a list of existing warehouses and adds a `warehouseName` field (with respect to warehouseId) to each entry.
 *
 * @param entries
 * @param warehouses
 * @returns
 */
export const addWarehouseData = (entries: Iterable<VolumeStock>, warehouses: WarehouseDataMap): Iterable<VolumeStockClient> => {
	return map(entries, (e) => {
		return {
			...e,
			warehouseName: warehouses.get(e.warehouseId)?.displayName || "not-found",
			warehouseDiscount: warehouses.get(e.warehouseId)?.discountPercentage || 0
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
		const availableWarehouses: NavMap<{ quantity: number }> = new Map(
			wrapIter(stock.isbn(e.isbn))
				.filter(([[, warehouseId]]) => warehouses.get(warehouseId) != null)
				.map(([[, warehouseId], { quantity = 0 }]) => [
					warehouseId,
					{ displayName: warehouses.get(warehouseId)?.displayName || "not-found", quantity }
				])
		);
		return { ...e, availableWarehouses };
	});
};
