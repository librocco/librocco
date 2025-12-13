import { browser } from "$app/environment";

import { getPlacedSupplierOrderLines, getPlacedSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { PlacedSupplierOrderLine } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ params, depends }: Parameters<PageLoad>[0]) => {
	// Reactive on book data displayed in the table
	depends("book:data");
	// Reactive on reconciled state -- calculated from existing reconciliation orders
	depends("reconciliation:orders");

	if (!browser) {
		return { orderLines: [] as PlacedSupplierOrderLine[] };
	}

	const id = parseInt(params.id);

	const db = await getDb(app);

	// TODO: replace this with a specific query (get order by id)
	const supplierOrders = await getPlacedSupplierOrders(db);
	const order = supplierOrders.find((o) => o.id === id);
	// TODO: redirect if order doesn't exist

	const orderLines = await getPlacedSupplierOrderLines(db, [id]);

	return { ...order, orderLines };
};

export const load: PageLoad = timed(_load);
