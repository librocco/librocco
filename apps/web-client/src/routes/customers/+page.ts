import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";

export const load = async () => {
	const db = await getInitializedDB("librocco-current-db");

	const customers = await getAllCustomers(db);

	return {
		db,
		customers
	};
};
