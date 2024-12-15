import { getPossibleSupplierOrderLines } from "$lib/db/orders/suppliers";

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, params }) => {
	const { ordersDb } = await parent();

	const orderLines = await getPossibleSupplierOrderLines(ordersDb, parseInt(params.id));

	return { orderLines };
};

export const ssr = false;
