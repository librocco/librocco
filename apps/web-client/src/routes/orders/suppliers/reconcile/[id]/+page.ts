import { getReconciliationOrder, getReconciliationOrderLines } from "$lib/db/cr-sqlite/order-reconciliation";
import type { PageLoad } from "./$types";
import { getPlacedSupplierOrderLinesForReconciliation } from "$lib/db/cr-sqlite/suppliers";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("reconciliationOrder:data");

	const { ordersDb } = await parent();
	const reconciliationOrder = await getReconciliationOrder(ordersDb, parseInt(params.id));
	const reconciliationOrderLines = await getReconciliationOrderLines(ordersDb, parseInt(params.id));

	const placedOrderLines = await getPlacedSupplierOrderLinesForReconciliation(ordersDb, reconciliationOrder.supplierOrderIds);

	return { reconciliationOrder, ordersDb, placedOrderLines, reconciliationOrderLines };
};
