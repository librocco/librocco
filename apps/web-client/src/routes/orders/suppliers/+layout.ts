import { getInitializedDB } from "$lib/db/cr-sqlite";
import { getAllReconciliationOrders } from "$lib/db/cr-sqlite/order-reconciliation";

import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ depends }) => {
	depends("suppliers:data");

	const dbCtx = await getInitializedDB("librocco-current-db");
	const { db } = dbCtx;
	const possibleOrdersInfo = await getPossibleSupplierOrders(db);
	const placedOrders = await getPlacedSupplierOrders(db);

	const reconciliationOrders = await getAllReconciliationOrders(db);

	return { placedOrders, possibleOrders: possibleOrdersInfo, ordersDb: db, reconciliationOrders, dbCtx };
};

export const ssr = false;
