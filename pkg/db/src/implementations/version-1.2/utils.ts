import { map } from "@librocco/shared";

import { EntriesStreamResult, NavMap, VolumeStock, VolumeStockClient } from "@/types";

import { versionId } from "@/utils/misc";

export const combineTransactionsWarehouses =
	({ includeAvailableWarehouses }: { includeAvailableWarehouses: boolean }) =>
	([entries, stats, warehouses]: [VolumeStock[], { total: number; totalPages: number }, NavMap]): EntriesStreamResult => {
		const rows = [
			...(includeAvailableWarehouses
				? addAvailableWarehouses(addWarehouseNames(entries, warehouses), warehouses)
				: addWarehouseNames(entries, warehouses))
		];

		return { ...stats, rows };
	};

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
export const addAvailableWarehouses = (entries: Iterable<VolumeStockClient>, warehouses: NavMap): Iterable<VolumeStockClient> => {
	const availableWarehouses: NavMap = new Map(warehouses);
	availableWarehouses.delete(versionId("0-all"));
	return map(entries, (e) => ({ ...e, availableWarehouses }));
};
