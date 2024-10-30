import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";
import { customers } from "$lib/stores/orders";

export const load = async () => {
	const ordersDb = await getInitializedDB("librocco-current-db");

	const allCustomers = await getAllCustomers(ordersDb);

	customers.set(allCustomers);
	return { ordersDb };
};

export const ssr = false;
