import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";

import { currentDB, customers } from "$lib/stores/orders";

export const load = async () => {
	const ordersDb = await getInitializedDB("librocco-current-db");
	currentDB.set(ordersDb);

	const allCustomers = await getAllCustomers(ordersDb);

	customers.set(allCustomers);
	return { ordersDb };
};

export const ssr = false;
