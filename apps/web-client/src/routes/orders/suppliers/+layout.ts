import { getInitializedDB } from "$lib/db/cr-sqlite";

import { getUnreconciledSupplierOrders, getAllReconciliationOrders } from "$lib/db/cr-sqlite/order-reconciliation";
import { getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ depends }) => {
	depends("suppliers:data");

	const { db, rx } = await getInitializedDB("librocco-current-db");
	const possibleOrdersInfo = await getPossibleSupplierOrders(db);
	const placedOrders = await getUnreconciledSupplierOrders(db);
	const reconcilingOrders = await getAllReconciliationOrders(db, false);

	return { placedOrders, possibleOrders: possibleOrdersInfo, ordersDb: db, rx, reconcilingOrders };
};

export const ssr = false;
