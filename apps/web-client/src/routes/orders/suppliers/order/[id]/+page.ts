import type { PageLoad } from "./$types";
import { getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";

export const load: PageLoad = async ({ parent, params }) => {
	const { ordersDb } = await parent();

	const orderLines = await getPlacedSupplierOrderLines(ordersDb, [parseInt(params.id)]);

	return { orderLines };
};

export const ssr = false;
