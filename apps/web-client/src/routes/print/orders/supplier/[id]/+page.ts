import { getPlacedSupplierOrderLines, getPlacedSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { PlacedSupplierOrderLine, PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";
import { redirect } from "@sveltejs/kit";
import { appPath } from "$lib/paths";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = parseInt(params.id);

	// Add dependencies if they were relevant in the original or might be for print
	depends("book:data"); // For book details in order lines
	depends("reconciliation:orders"); // If order status/details depend on reconciliation

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return {
			id,
			order: null,
			orderLines: [] as PlacedSupplierOrderLine[]
		};
	}

	// TODO: Ideally, replace getPlacedSupplierOrders with a function like getPlacedSupplierOrderById(db, id)
	// For now, filtering from all orders as per the original file.
	const supplierOrders = await getPlacedSupplierOrders(dbCtx.db);
	const order = supplierOrders.find((o) => o.id === id);

	if (!order) {
		// Redirect if order not found
		redirect(307, appPath("orders/suppliers")); // Adjust path as needed
	}

	const orderLines = await getPlacedSupplierOrderLines(dbCtx.db, [id]);

	return { id, order, orderLines };
};

export const ssr = false;

export const load: PageLoad = timed(_load);
