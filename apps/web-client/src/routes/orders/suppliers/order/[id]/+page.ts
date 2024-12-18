import type { SupplierOrderLine } from "$lib/db/orders/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, params }) => {
	const { placedOrders } = await parent();
	const placedOrder = placedOrders?.find((order) => order.id === parseInt(params.id));

	/** @TODO if id is not found */

	const lines: SupplierOrderLine[] = JSON.parse(placedOrder.line_items);
	return { placedOrder, lines };
};

export const ssr = false;
