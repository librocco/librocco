import { base } from "$app/paths";

const HASHES = {
	debug: "#/debug/",
	// Inventory mgmt
	stock: "#/stock/",
	books: "#/books/",
	warehouses: "#/inventory/warehouses/",
	inventory: "#/inventory/",
	inbound: "#/inventory/inbound/",
	outbound: "#/outbound/",
	settings: "#/settings/",
	"history/date": "#/history/date/",
	"history/isbn": "#/history/isbn/",
	"history/notes/date": "#/history/notes/",
	"history/notes/archive": "#/history/notes/archive",
	"history/warehouse": "#/history/warehouse/",

	// Order mgmt
	customers: "#/orders/customers/",
	suppliers: "#/orders/suppliers/",
	supplier_orders: "#/orders/suppliers/orders/",
	reconcile: "#/orders/suppliers/reconcile/"
};

const PATHS: { [key: string]: string } = Object.fromEntries(Object.entries(HASHES).map(([key, hash]) => [key, `${base}/${hash}`]));

/**
 * We're using this util to construct app paths. This is preferable to using constants as it
 * allows us to construct paths with dynamic segments, while performing some additional sanitization:
 * - requires the first segment to be the location key (e.g. "stock", "inventory", etc.)
 * - joins all of the segments with "/"
 * - ensures that the path ends with "/" (adds a trailing slash if neecessary)
 * - ensures that there are no double slashes in the path
 * (often a result of joining constants + dynamis segments, e.g. `${base}/stock/${id}` -> base might or might not end with a slash)
 * @param location - the location key (e.g. "stock", "inventory", etc.)
 * @param segments - the dynamic segments of the path
 */
export const appPath = (location: keyof typeof PATHS, ...segments: (number | string)[]) => {
	return [PATHS[location], ...segments].join("/").concat("/").replaceAll(/\/\/+/g, "/");
};

export const appHash = (location: keyof typeof HASHES, ...segments: (number | string)[]) => {
	return [HASHES[location], ...segments].join("/").concat("/").replaceAll(/\/\/+/g, "/");
};
