import * as net from "net";

export const IS_CI = /^(?:1|true|on)$/i.test(process.env.CI?.trim() ?? "");
export const VFS_TEST = process.env.VFS_TEST === "true";
export const SHARD_INDEX = process.env.PLAYWRIGHT_SHARD_INDEX;

export function getPort(): Promise<number> {
	const testSocket = new net.Socket();

	return new Promise<number>((resolve) => {
		testSocket.on("error", () => {
			console.log("Using development server on local port 5173");
			testSocket.destroy();
			resolve(5173);
		});

		testSocket.connect(4173, "localhost", () => {
			console.log("Using preview build on local port 4173");
			testSocket.end();
			resolve(4173);
		});
	});
}

const port = await getPort();
// In CI, use Caddy's HTTPS endpoint; locally use detected dev/preview server
export const baseURL = IS_CI ? `https://localhost:8080/preview/` : `http://localhost:${port}/preview/`;
export const HASHES = {
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
	"history/notes/archive": "#/history/notes/archive/",
	"history/warehouse": "#/history/warehouse/",

	// Order mgmt
	customers: "#/orders/customers/",
	suppliers: "#/orders/suppliers/",
	supplier_orders: "#/orders/suppliers/orders/",
	reconcile: "#/orders/suppliers/reconcile/"
};
export const appHash = (location: keyof typeof HASHES, ...segments: (number | string)[]) => {
	return [HASHES[location], ...segments].join("/").concat("/").replaceAll(/\/\/+/g, "/");
};

/** Max timeout for DOM assertions (waitFor, etc. - longer in CI, default in non-CI) */
export const assertionTimeout = IS_CI ? 15000 : undefined;

// In CI, use Caddy's HTTPS proxy to avoid mixed content issues (page loads via HTTPS)
// Locally, connect directly to sync server on port 3000
export const remoteDbURL = IS_CI ? "https://localhost:8080/" : "http://127.0.0.1:3000/";
export const syncUrl = IS_CI ? "wss://localhost:8080/sync" : "ws://127.0.0.1:3000/sync";
