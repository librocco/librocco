import type { PageLoad } from "./$types";

import type { Customer, CustomerOrderLine } from "$lib/db/cr-sqlite/types";

import { getCustomerOrderLines, getCustomerDetails } from "$lib/db/cr-sqlite/customers";
import { getPublisherList } from "$lib/db/cr-sqlite/books";
import { resolveDbCtx } from "$lib/utils/loading";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	depends("customer:data");
	depends("customer:books");

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	// TODO: Retirect to customers page perhaps
	const customerPromise = dbCtxPromise.then(async (ctx) => {
		if (!ctx) return {} as Customer;
		return (await getCustomerDetails(ctx.db, Number(params.id))) || ({} as Customer);
	});

	const customerOrderLinesPromise = dbCtxPromise.then((ctx) => {
		if (!ctx) return [];
		return getCustomerOrderLines(ctx.db, Number(params.id));
	});

	const publisherListPromise = dbCtxPromise.then((ctx) => {
		if (!ctx) return [];
		return getPublisherList(ctx.db);
	});

	return {
		dbCtx: dbCtxPromise,
		customer: customerPromise,
		customerOrderLines: customerOrderLinesPromise,
		publisherList: publisherListPromise
	};
};

export const load: PageLoad = timed(_load);
