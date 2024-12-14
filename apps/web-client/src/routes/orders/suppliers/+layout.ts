import { getInitializedDB } from "$lib/db/orders";

import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/orders/suppliers";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ depends }) => {
	depends("suppliers:data");

	const ordersDb = await getInitializedDB("librocco-current-db");
	const possibleOrdersInfo = await getPossibleSupplierOrders(ordersDb);
	const placedOrders = await getPlacedSupplierOrders(ordersDb);

	return { placedOrders, possibleOrders: possibleOrdersInfo, ordersDb };
};

export const ssr = false;
