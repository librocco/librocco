import type { LayoutLoad } from "./$types";

import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers, getAllCustomerOrderLines } from "$lib/db/orders/customers";

export const load: LayoutLoad = async ({ depends }) => {
	depends("customer:data");

	const ordersDb = await getInitializedDB("librocco-current-db");

	const customers = await getAllCustomers(ordersDb);

	const customerOrderLines = await getAllCustomerOrderLines(ordersDb);

	return { ordersDb, customers, customerOrderLines };
};

export const ssr = false;
