import type { PageLoad } from "./$types";
import type { CustomerOrderListItem } from "$lib/db/cr-sqlite/types";

import { getCustomerOrderList } from "$lib/db/cr-sqlite/customers";
import { resolveDbCtx } from "$lib/utils/loading";

import { timed } from "$lib/utils/timer";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
	depends("customer:list");

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	const customerOrdersPromise = dbCtxPromise.then((ctx) => {
		if (!ctx) return [];
		return getCustomerOrderList(ctx.db);
	});

	return { dbCtx: dbCtxPromise, customerOrders: customerOrdersPromise };
};

export const load: PageLoad = timed(_load);
