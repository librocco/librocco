import type { PageLoad } from "./$types";
import { currentCustomer } from "$lib/stores/orders";
import { getCustomerBooks, getCustomerDetails } from "$lib/db/orders/customers";
import type { Customer } from "$lib/db/orders/types";

export const load: PageLoad = async ({ parent, params }) => {
	const { ordersDb } = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!ordersDb) {
		return {};
	}

	/** @TODO in customer orders page, we need to get the latest/biggest customer id
	 and increment it */
	const customerBooks = await getCustomerBooks(ordersDb, Number(params.id));
	const customerDetails = await getCustomerDetails(ordersDb, Number(params.id));

	currentCustomer.update((prev) =>
		prev && prev.customerDetails.id === customerDetails[0].id ? prev : { customerBooks, customerDetails: customerDetails[0] }
	);

	return { customerBooks, customerDetails: customerDetails[0] || ({} as Customer) };
};
