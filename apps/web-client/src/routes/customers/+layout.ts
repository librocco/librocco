import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";

export const load = async () => {
	const ordersDb = await getInitializedDB("librocco-current-db");

	const allCustomers = await getAllCustomers(ordersDb);

	return { ordersDb, allCustomers };
};

export const ssr = false;
