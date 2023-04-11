import { EntriesStreamResult, NavListEntry, VolumeStockClient } from "@/types";

import { versionId } from "@/utils/misc";

export const combineTransactionsWarehouses =
	({ includeAvailableWarehouses }: { includeAvailableWarehouses: boolean }) =>
	([entries, stats, warehouses]: [VolumeStockClient[], { total: number; totalPages: number }, NavListEntry[]]): EntriesStreamResult => {
		// Create a record of warehouse ids and names for easy lookup
		const warehouseNames = warehouses.reduce(
			(acc, { id, displayName }) => ({ ...acc, [id]: displayName }),
			{} as Record<string, string>
		);

		const warehouseSelection = Object.entries(warehouseNames)
			.filter(([id]) => id !== versionId("0-all"))
			.map(([value, label]) => ({ value, label }));

		const rows = entries.map((e) => {
			const entry = { ...e } as VolumeStockClient;

			entry.warehouseName = warehouseNames[e.warehouseId] || "not-found";

			if (includeAvailableWarehouses) {
				entry.availableWarehouses = warehouseSelection;
			}

			return entry;
		});

		return { ...stats, rows };
	};
