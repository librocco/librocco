import type { PageLoad } from "./$types";
import { getCustomerBooks, getCustomerDetails } from "$lib/db/cr-sqlite/customers";
import type { Customer } from "$lib/db/cr-sqlite/types";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("customer:data");
	depends("customer:books");

	const data = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!data?.ordersDbCtx?.db) {
		return {};
	}

	const { db } = data.ordersDbCtx;

	const [customer = {} as Customer] = await getCustomerDetails(db, Number(params.id));
	const customerOrderLines = await getCustomerBooks(db, Number(params.id));

	return { customer, customerOrderLines };
};
