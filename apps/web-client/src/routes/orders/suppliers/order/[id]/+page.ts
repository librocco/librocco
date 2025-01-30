import type { PageLoad } from "./$types";
import { getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";

export const load: PageLoad = async ({ parent, params }) => {
	const { ordersDb } = await parent();

	const placedOrder = await getPlacedSupplierOrderLines(ordersDb, [parseInt(params.id)]);

	return { placedOrder };
};

export const ssr = false;
