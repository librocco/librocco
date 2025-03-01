import { getAllReconciliationOrders } from "$lib/db/cr-sqlite/order-reconciliation";
import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { PlacedSupplierOrder, PossibleSupplierOrder } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ depends, parent }) => {
	depends("suppliers:data");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { placedOrders: [] as PlacedSupplierOrder[], possibleOrders: [] as PossibleSupplierOrder[] };
	}

	const { db } = dbCtx;

	const allSupplierOrders = await getPlacedSupplierOrders(db);
	const possibleOrders = await getPossibleSupplierOrders(dbCtx.db);
	const placedOrders = await getPlacedSupplierOrders(dbCtx.db, { reconciled: false });
	const reconcilingOrders = await getAllReconciliationOrders(db, { finalized: false });

	// TEMP
	console.log("all supplier orders:");
	console.log(JSON.stringify(allSupplierOrders, null, 2));
	console.log("possible orders:");
	console.log(JSON.stringify(possibleOrders, null, 2));
	console.log("placed orders:");
	console.log(JSON.stringify(placedOrders, null, 2));

	return { possibleOrders, placedOrders, reconcilingOrders };
};

export const ssr = false;
