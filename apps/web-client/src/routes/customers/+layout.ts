import { getInitializedDB } from "$lib/db/orders";
import { getAllCustomers } from "$lib/db/orders/customers";
import { customerOrders } from "$lib/stores/orders";

export const load = async () => {
	const ordersDb = await getInitializedDB("librocco-current-db");

	const customers = await getAllCustomers(ordersDb);

	customerOrders.set({ customers });
	return { ordersDb };
};
