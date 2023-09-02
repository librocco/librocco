import { map, StockMap } from "@librocco/shared";

import { VolumeStock } from "@librocco/shared";

import { EntriesStreamResult, NavMap, VolumeStockClient } from "@/types";

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

type Params = [TableData, NavMap, ...any[]];
type ParamsWithAvailableWarehouses = [TableData, NavMap, StockMap];

export function combineTransactionsWarehouses(opts: {
	includeAvailableWarehouses: true;
}): (params: ParamsWithAvailableWarehouses) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }): (params: Params) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }) {
	return opts?.includeAvailableWarehouses
		? ([{ rows, stats }, warehouses, stock]: ParamsWithAvailableWarehouses): EntriesStreamResult => ({
				...stats,
				rows: [...addAvailableWarehouses(addWarehouseNames(rows, warehouses), warehouses, stock)]
		  })
		: ([{ rows, stats }, warehouses]: Params): EntriesStreamResult => ({
				...stats,
				rows: [...addWarehouseNames(rows, warehouses)]
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
			map(stock.isbn(e.isbn), ([[, warehouseId]]) => [warehouseId, warehouses.get(warehouseId) || { displayName: "not-found" }])
		);
		return { ...e, availableWarehouses };
	});
};
