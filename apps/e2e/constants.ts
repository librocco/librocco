import * as net from "net";

export const IS_CI = /^(?:1|true|on)$/i.test(process.env.CI?.trim() ?? "");

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
export const baseURL = `http://localhost:${port}/preview/`;
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
