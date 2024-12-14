import { getInitializedDB } from "$lib/db/orders";

import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/orders/suppliers";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ depends }) => {
	depends("suppliers:data");

	const { db } = await getInitializedDB("librocco-current-db");
	const possibleOrdersInfo = await getPossibleSupplierOrders(db);
	const placedOrders = await getPlacedSupplierOrders(db);

	return { placedOrders, possibleOrders: possibleOrdersInfo, ordersDb: db };
};

export const ssr = false;
