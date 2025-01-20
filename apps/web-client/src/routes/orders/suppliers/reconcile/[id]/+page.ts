import { getReconciliationOrder, getReconciliationOrderLines } from "$lib/db/cr-sqlite/order-reconciliation";
import type { PageLoad } from "./$types";
import { getPlacedSupplierOrderLinesForReconciliation } from "$lib/db/cr-sqlite/suppliers";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("reconciliationOrder:data");

	const { ordersDb } = await parent();
	const reconciliationOrder = await getReconciliationOrder(ordersDb, parseInt(params.id));
	const reconciliationOrderLines = await getReconciliationOrderLines(ordersDb, parseInt(params.id));

	const supplierOrderIds = JSON.parse(reconciliationOrder.supplier_order_ids);

	const placedOrderLines = await getPlacedSupplierOrderLinesForReconciliation(ordersDb, supplierOrderIds);

	return { reconciliationOrder, ordersDb, placedOrderLines, reconciliationOrderLines };
};

export const ssr = false;
