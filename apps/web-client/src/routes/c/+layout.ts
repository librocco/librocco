import type { LayoutLoad } from "../$types";

import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";

export const load: LayoutLoad = async ({ depends }) => {
	depends("customer:data");

	const ordersDb = await getInitializedDB("librocco-current-db");
	const { db } = ordersDb;

	const allCustomers = await getAllCustomers(db);

	return { ordersDb, allCustomers };
};

export const ssr = false;
