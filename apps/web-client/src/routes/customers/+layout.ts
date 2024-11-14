import type { LayoutLoad } from "../$types";

import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";

export const load: LayoutLoad = async ({ depends }) => {
	depends("customer:data");

	const dbCtx = await getInitializedDB("librocco-current-db");

	const allCustomers = await getAllCustomers(dbCtx.db);

	return { dbCtx, allCustomers };
};

export const ssr = false;
