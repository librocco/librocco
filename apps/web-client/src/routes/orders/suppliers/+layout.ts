import { getUnreconciledSupplierOrders } from "$lib/db/cr-sqlite/order-reconciliation";

import { getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";
import type { PlacedSupplierOrder, PossibleSupplierOrder } from "$lib/db/cr-sqlite/types";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ depends, parent }) => {
	depends("suppliers:data");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { placedOrders: [] as PlacedSupplierOrder[], possibleOrders: [] as PossibleSupplierOrder[] };
	}

	const possibleOrders = await getPossibleSupplierOrders(dbCtx.db);
	const placedOrders = await getUnreconciledSupplierOrders(dbCtx.db);

	return { placedOrders, possibleOrders };
};

export const ssr = false;
