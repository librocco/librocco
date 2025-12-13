import { browser } from "$app/environment";

import type { PageLoad } from "./$types";
import type { PlacedSupplierOrderLine, ReconciliationOrder, ReconciliationOrderLine } from "$lib/db/cr-sqlite/types";

import { getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";
import { getReconciliationOrder, getReconciliationOrderLines } from "$lib/db/cr-sqlite/order-reconciliation";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ params, depends }: Parameters<PageLoad>[0]) => {
	depends("reconciliationOrder:data");

	if (!browser) {
		return {
			reconciliationOrder: {} as ReconciliationOrder,
			placedOrderLines: [] as PlacedSupplierOrderLine[],
			reconciliationOrderLines: [] as ReconciliationOrderLine[]
		};
	}

	const db = await getDb(app);

	const reconciliationOrder = await getReconciliationOrder(db, parseInt(params.id));
	const reconciliationOrderLines = await getReconciliationOrderLines(db, parseInt(params.id));

	const placedOrderLines = await getPlacedSupplierOrderLines(db, reconciliationOrder.supplierOrderIds);

	return { reconciliationOrder, placedOrderLines, reconciliationOrderLines };
};

export const load: PageLoad = timed(_load);
