import type { PageLoad } from "./$types";
import type { PlacedSupplierOrderLine, ReconciliationOrder, ReconciliationOrderLine } from "$lib/db/cr-sqlite/types";

import { getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";
import { getReconciliationOrder, getReconciliationOrderLines } from "$lib/db/cr-sqlite/order-reconciliation";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("reconciliationOrder:data");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return {
			reconciliationOrder: {} as ReconciliationOrder,
			placedOrderLines: [] as PlacedSupplierOrderLine[],
			reconciliationOrderLines: [] as ReconciliationOrderLine[]
		};
	}

	const reconciliationOrder = await getReconciliationOrder(dbCtx.db, parseInt(params.id));
	const reconciliationOrderLines = await getReconciliationOrderLines(dbCtx.db, parseInt(params.id));

	const placedOrderLines = await getPlacedSupplierOrderLines(dbCtx.db, reconciliationOrder.supplierOrderIds);

	return { reconciliationOrder, placedOrderLines, reconciliationOrderLines };
};

export const ssr = false;
