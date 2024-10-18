import type { PageLoad } from "./$types";

// import type { CustomerOrderLine } from "$lib/components/Tables/types";
import { getCustomerBooks, getCustomerDetails } from "$lib/db/orders/customers";
import type { CustomerOrderLine, Customer } from "$lib/db/orders/types";

export const load: PageLoad = async ({ parent, params }) => {
	const { db } = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!db) {
		return {};
	}

	//in customer orders page, we need to get the latest/biggest customer id
	// and increment it

	const customerBooks = await getCustomerBooks(db, Number(params.id));
	const customerDetails = await getCustomerDetails(db, Number(params.id));

	return { customerBooks, customerDetails: customerDetails[0] || ({} as Customer) };
};
