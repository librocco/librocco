import { getPlacedSupplierOrderLines, getPlacedSupplierOrders } from "$lib/db/suppliers";

import type { PlacedSupplierOrderLine } from "$lib/db/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	// Reactive on book data displayed in the table
	depends("book:data");
	// Reactive on reconciled state -- calculated from existing reconciliation orders
	depends("reconciliation:orders");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { orderLines: [] as PlacedSupplierOrderLine[] };
	}

	const id = parseInt(params.id);

	// TODO: replace this with a specific query (get order by id)
	const supplierOrders = await getPlacedSupplierOrders(dbCtx.db);
	const order = supplierOrders.find((o) => o.id === id);
	// TODO: redirect if order doesn't exist

	const orderLines = await getPlacedSupplierOrderLines(dbCtx.db, [id]);

	return { ...order, orderLines };
};

export const ssr = false;

export const load: PageLoad = timed(_load);
