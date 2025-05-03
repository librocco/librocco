import type { PageLoad } from "./$types";
import type { CustomerOrderListItem } from "$lib/db/types";

import { getCustomerOrderList } from "$lib/db/customers";

import { timed } from "$lib/utils/timer";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
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

export const load: PageLoad = timed(_load);
