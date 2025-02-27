import type { PageLoad } from "./$types";
import type { CustomerOrderListItem } from "$lib/db/cr-sqlite/types";

import { getCustomerOrderList } from "$lib/db/cr-sqlite/customers";

export const load: PageLoad = async ({ depends, parent }) => {
	depends("customer:list");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { customerOrders: [] as CustomerOrderListItem[] };
	}

	const customerOrders = await getCustomerOrderList(dbCtx.db);

	return { customerOrders };
};

export const ssr = false;
