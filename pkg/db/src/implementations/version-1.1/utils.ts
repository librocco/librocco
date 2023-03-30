import { EntriesStreamResult, NavListEntry, VolumeStockClient } from "@/types";

export const combineTransactionsWarehouses = ([entries, stats, warehouses]: [
	VolumeStockClient[],
	{ total: number; totalPages: number },
	NavListEntry[]
]): EntriesStreamResult => {
	// Create a record of warehouse ids and names for easy lookup
	const warehouseNames = warehouses.reduce((acc, { id, displayName }) => ({ ...acc, [id]: displayName }), {});

	// Combine the entries with their respective warehouse names
	const rows = entries.map((e) => ({
		...e,
		warehouseName: warehouseNames[e.warehouseId] || "not-found"
	}));

	return { ...stats, rows };
};
