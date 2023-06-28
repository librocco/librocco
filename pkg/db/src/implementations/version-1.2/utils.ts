import { EntriesStreamResult, NavListEntry, VolumeStock, VolumeStockClient } from "@/types";

import { versionId } from "@/utils/misc";

export const combineTransactionsWarehouses =
	({ includeAvailableWarehouses }: { includeAvailableWarehouses: boolean }) =>
	([entries, stats, warehouses]: [VolumeStock[], { total: number; totalPages: number }, NavListEntry[]]): EntriesStreamResult => {
		const rows = includeAvailableWarehouses
			? addAvailableWarehouses(addWarehouseNames(entries, warehouses), warehouses)
			: addWarehouseNames(entries, warehouses);

		return { ...stats, rows };
	};

/**
 * Takes in a list of VolumeStock entries and a list of existing warehouses and adds a `warehouseName` field (with respect to warehouseId) to each entry.
 * @TODO_ITERABLES replace the processing with a iterable function and
 * @TODO_ITERABLES take in an iterable of entries (instead of an array) and a map of warehouses (instead of a list)
 *
 * @param entries
 * @param warehouses
 * @returns
 */
export const addWarehouseNames = (entries: VolumeStock[], warehouses: NavListEntry[]): VolumeStockClient[] => {
	const warehouseNameLookup = newWarehouseNameLookup(warehouses);

	return entries.map((e) => {
		const entry = { ...e } as VolumeStockClient;
		entry.warehouseName = warehouseNameLookup.get(e.warehouseId) || "not-found";
		return entry;
	});
};

/**
 * Takes in a list of VolumeStockClient entries and a list of existing warehouses and adds an `availableWarehouses` field to each entry (omitting the default warehouse).
 * @TODO_ITERABLES replace the processing with a iterable function and
 * @TODO_ITERABLES take in an iterable of entries (instead of an array) and a map of warehouses (instead of a list)
 *
 * @param entries
 * @param warehouses
 * @returns
 */
export const addAvailableWarehouses = (entries: VolumeStockClient[], warehouses: NavListEntry[]): VolumeStockClient[] => {
	const warehouseNameLookup = newWarehouseNameLookup(warehouses);
	warehouseNameLookup.delete(versionId("0-all"));
	const availableWarehouses = [...warehouseNameLookup.entries()].map(([value, label]) => ({ value, label }));
	return entries.map((e) => ({ ...e, availableWarehouses }));
};

const newWarehouseNameLookup = (warehouses: NavListEntry[]) =>
	new Map(
		(function* () {
			for (const { id, displayName } of warehouses) {
				yield [id, displayName];
			}
		})()
	);
