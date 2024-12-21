import type { LayoutLoad } from "../$types";

import { getInitializedDB } from "$lib/db/cr-sqlite";
import { getAllCustomers } from "$lib/db/cr-sqlite/customers";

export const load: LayoutLoad = async ({ depends }) => {
	depends("customer:data");

	const dbCtx = await getInitializedDB("librocco-current-db");
	const { db } = dbCtx;

	const allCustomers = await getAllCustomers(db);

	return { ordersDbCtx: dbCtx, allCustomers };
};

export const ssr = false;
