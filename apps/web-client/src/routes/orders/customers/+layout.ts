import type { LayoutLoad } from "./$types";

import { getAllCustomers, getAllCustomerOrderLines } from "$lib/db/cr-sqlite/customers";

export const load: LayoutLoad = async ({ depends, parent }) => {
	depends("customer:data");
	depends("customer:books");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { customers: [], customerOrderLines: [] };
	}

	const customers = await getAllCustomers(dbCtx.db);
	const customerOrderLines = await getAllCustomerOrderLines(dbCtx.db);

	return { customers, customerOrderLines };
};

export const ssr = false;
