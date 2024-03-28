import { map, StockMap } from "@librocco/shared";

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
	defaultWarehouse?: string;
}): (params: ParamsWithAvailableWarehouses) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: {
	includeAvailableWarehouses: boolean;
	defaultWarehouse?: string;
}): (params: Params) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean; defaultWarehouse?: string }) {
	return opts?.includeAvailableWarehouses
		? ([{ rows, stats }, warehouses, stock]: ParamsWithAvailableWarehouses): EntriesStreamResult => ({
				...stats,
			rows: [
				...addDefaultWarehouse(addAvailableWarehouses(addWarehouseData(rows, warehouses), warehouses, stock), opts?.defaultWarehouse || "")
			]
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
			map(stock.isbn(e.isbn), ([[, warehouseId], { quantity = 0 }]) => [
				warehouseId,
				{ displayName: warehouses.get(warehouseId)?.displayName || "not-found", quantity }
			])
		);
		return { ...e, availableWarehouses };
	});
};

/**
 * Takes in a list of VolumeStockClient entries and the note's default warehouse and assigns the default warehouse to the entries if it's in the list of available warehouses.
 *
 * @param entries
 * @param defaultWarehouse
 * @returns
 */
export const addDefaultWarehouse = (entries: Iterable<VolumeStockClient>, defaultWarehouseId: string): Iterable<VolumeStockClient> => {
	return map(entries, (e) => {
		const defaultWarehouseAvailable = defaultWarehouseId !== undefined && e.availableWarehouses?.has(defaultWarehouseId);
		const warehouseId = defaultWarehouseAvailable ? defaultWarehouseId : e.warehouseId;
		const warehouseName = defaultWarehouseAvailable ? e.availableWarehouses?.get(defaultWarehouseId)?.displayName || "" : e.warehouseName;
		return { ...e, warehouseId, warehouseName };
	});
};
