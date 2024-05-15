import { map, StockMap } from "@librocco/shared";

import { VolumeStock } from "@librocco/shared";

import { EntriesStreamResult, NavMap, VolumeStockClient, VolumeStockCsv, WarehouseDataMap } from "@/types";

import { createVersioningFunction } from "@/utils/misc";

export const versionId = createVersioningFunction("v1");

export type TableData = {
	/** Rows to display for a page */
	rows: Iterable<VolumeStock>;
	total: number;
};

type Params = [TableData, WarehouseDataMap, ...any[]];
type ParamsWithAvailableWarehouses = [TableData, WarehouseDataMap, StockMap];

export function combineTransactionsWarehouses(opts: {
	includeAvailableWarehouses: true;
}): (params: ParamsWithAvailableWarehouses) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }): (params: Params) => EntriesStreamResult;
export function combineTransactionsWarehouses(opts?: { includeAvailableWarehouses: boolean }) {
	return opts?.includeAvailableWarehouses
		? ([{ rows, total }, warehouses, stock]: ParamsWithAvailableWarehouses): EntriesStreamResult => ({
			total,
			rows: [...addAvailableWarehouses(addWarehouseData(rows, warehouses), warehouses, stock)]
		})
		: ([{ rows, total }, warehouses]: Params): EntriesStreamResult => ({
			total,
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
		// Custom items don't require additional processing
		if (e.__kind === "custom") {
			return e;
		}

		// Add additional data to book rows
		return {
			...e,
			__kind: "book",
			warehouseName: warehouses.get(e.warehouseId)?.displayName || "not-found",
			warehouseDiscount: warehouses.get(e.warehouseId)?.discountPercentage || 0
		};
	});
};

/**
 * Takes in a list of VolumeStock entries and a list of existing warehouses and adds a `warehouseName`.
 *
 * @param entries
 * @param warehouses
 * @returns
 */
export const addWarehouseName = (entries: Iterable<VolumeStock>, warehouses: WarehouseDataMap): Iterable<VolumeStockCsv> => {
	return map(entries, (e) => {
		if (e.__kind === "custom") {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { __kind, ...rest } = e;
			return rest;
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { __kind, warehouseId, ...rest } = e;
		return {
			...rest,
			warehouseName: warehouses.get(e.warehouseId)?.displayName || "not-found",
			warehouseDiscount: warehouses.get(e.warehouseId)?.discountPercentage || 0
		};
	});
};

/**
 * Takes in a list of VolumeStockClient entries and a list of existing warehouses and a stockMap and adds an `availableWarehouses` field to each entry (omitting the default warehouse).
 *
 * @param entries
 * @param warehouses
 * @param stock
 * @returns
 */
export const addAvailableWarehouses = (
	entries: Iterable<VolumeStockClient>,
	warehouses: NavMap,
	stock: StockMap
): Iterable<VolumeStockClient> => {
	return map(entries, (e) => {
		// Custom items don't have a warehouse related data attached to them
		if (e.__kind === "custom") {
			return e;
		}

		const availableWarehouses: NavMap<{ quantity: number }> = new Map(
			map(stock.isbn(e.isbn), ([[, warehouseId], { quantity = 0 }]) => [
				warehouseId,
				{ displayName: warehouses.get(warehouseId)?.displayName || "not-found", quantity }
			])
		);
		return { ...e, availableWarehouses };
	});
};
