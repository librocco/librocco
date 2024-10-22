import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";

export const load = async () => {
	const ordersDb = await getInitializedDB("librocco-current-db");

	const customers = await getAllCustomers(ordersDb);

	return {
		ordersDb,
		customers
	};
};
