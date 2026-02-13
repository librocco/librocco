import { OrderItemStatus } from "@librocco/shared";

import { browser } from "$app/environment";

import type { PageLoad } from "./$types";
import type { CustomerOrderLine, PlacedSupplierOrderLine, ReconciliationOrder, ReconciliationOrderLine } from "$lib/db/cr-sqlite/types";

import { getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";
import { getReconciliationOrder, getReconciliationOrderLines } from "$lib/db/cr-sqlite/order-reconciliation";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";
import { getCustomerOrderLinesCore } from "$lib/db/cr-sqlite/customers";

const _load = async ({ params, depends, parent }: Parameters<PageLoad>[0]) => {
	await parent();
	depends("reconciliationOrder:data");

	if (!browser) {
		return {
			reconciliationOrder: {} as ReconciliationOrder,
			placedOrderLines: [] as PlacedSupplierOrderLine[],
			reconciliationOrderLines: [] as ReconciliationOrderLine[],
			customerOrderLines: [] as CustomerOrderLine[]
		};
	}

	const db = await getDb(app);

	const reconciliationOrder = await getReconciliationOrder(db, parseInt(params.id));
	const reconciliationOrderLines = await getReconciliationOrderLines(db, parseInt(params.id));

	const placedOrderLines = await getPlacedSupplierOrderLines(db, reconciliationOrder.supplierOrderIds);

	// Get open customer orders associated with supplier orders.
	// NOTE: we're getting all placed orders and filtering at display (use case: showing which customers will be notified of delivery).
	const isbns = Array.from(new Set(placedOrderLines.map(({ isbn }) => isbn)));

	// Collect pending as well for early fills in case of overdelivery (unlikely, but supported)
	const customerOrderLines = await getCustomerOrderLinesCore(db, { isbns, status: { lte: OrderItemStatus.Placed } });

	return { reconciliationOrder, placedOrderLines, reconciliationOrderLines, customerOrderLines };
};

export const load: PageLoad = timed(_load);
