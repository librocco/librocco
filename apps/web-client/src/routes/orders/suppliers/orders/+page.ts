import { getAllReconciliationOrders } from "$lib/db/cr-sqlite/order-reconciliation";
import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { PlacedSupplierOrder, PossibleSupplierOrder, ReconciliationOrder } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
	depends("books:data");
	depends("suppliers:data");
	depends("customers:order_lines");
	depends("reconciliation:orders");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return {
			possibleOrders: [] as PossibleSupplierOrder[],
			placedOrders: [] as PlacedSupplierOrder[],
			reconcilingOrders: [] as ReconciliationOrder[],
			completedOrders: [] as PlacedSupplierOrder[]
		};
	}

	const { db } = dbCtx;

	const possibleOrders = await getPossibleSupplierOrders(dbCtx.db);
	const placedOrders = await getPlacedSupplierOrders(dbCtx.db, { reconciled: false });
	const reconcilingOrders = await getAllReconciliationOrders(db, { finalized: false });
	const completedOrders = await getPlacedSupplierOrders(db, { finalized: true });

	return { possibleOrders, placedOrders, reconcilingOrders, completedOrders };
};

export const load: PageLoad = timed(_load);
