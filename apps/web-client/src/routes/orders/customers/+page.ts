import type { PageLoad } from "./$types";
import type { CustomerOrderListItem } from "$lib/db/cr-sqlite/types";

import { getCustomerOrderList } from "$lib/db/cr-sqlite/customers";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";
import { browser } from "$app/environment";

const _load = async ({ depends }: Parameters<PageLoad>[0]) => {
	depends("customer:list");

	if (!browser) {
		return { customerOrders: [] as CustomerOrderListItem[] };
	}

	const db = await getDb(app);

	const customerOrders = await getCustomerOrderList(db);

	return { customerOrders };
};

export const load: PageLoad = timed(_load);
