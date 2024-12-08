import { getInitializedDB } from "$lib/db/orders";

import { getPlacedSupplierOrders, getPossibleSupplerOrderInfos } from "$lib/db/orders/suppliers";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ depends }) => {
	depends("suppliers:data");

	const ordersDb = await getInitializedDB("librocco-current-db");
	const possibleOrdersInfo = await getPossibleSupplerOrderInfos(ordersDb);
	const placedOrders = await getPlacedSupplierOrders(ordersDb);

	return { placedOrders, possibleOrders: possibleOrdersInfo, ordersDb };
};

export const ssr = false;
