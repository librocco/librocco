import type { LayoutLoad } from "./$types";

import { getInitializedDB } from "$lib/db/cr-sqlite";
import { getAllCustomers, getAllCustomerOrderLines } from "$lib/db/cr-sqlite/customers";

export const load: LayoutLoad = async ({ depends }) => {
	depends("customer:data");
	depends("customer:books");

	console.log("running layout load");

	const dbCtx = await getInitializedDB("librocco-current-db");
	const { db } = dbCtx;

	const customers = await getAllCustomers(db);
	const customerOrderLines = await getAllCustomerOrderLines(db);

	console.log(customerOrderLines);

	// TODO: we could rename this to 'dbCtx' once the same approach is used in inventory db
	return { ordersDbCtx: dbCtx, customers, customerOrderLines };
};

export const ssr = false;
