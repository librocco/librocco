import { getAllReconciliationOrders } from "$lib/db/cr-sqlite/order-reconciliation";
import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { PlacedSupplierOrder, PossibleSupplierOrder } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ depends, parent }) => {
	depends("books:data");
	depends("suppliers:data");
	depends("customers:order_lines");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { placedOrders: [] as PlacedSupplierOrder[], possibleOrders: [] as PossibleSupplierOrder[] };
	}

	const { db } = dbCtx;

	const possibleOrders = await getPossibleSupplierOrders(dbCtx.db);
	const placedOrders = await getPlacedSupplierOrders(dbCtx.db, { reconciled: false });
	const reconcilingOrders = await getAllReconciliationOrders(db, { finalized: false });

	return { possibleOrders, placedOrders, reconcilingOrders };
};

export const ssr = false;
