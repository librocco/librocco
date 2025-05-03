import type { PageLoad } from "./$types";

import type { Customer, CustomerOrderLine } from "$lib/db/types";

import { getCustomerOrderLines, getCustomerDetails } from "$lib/db/customers";
import { getPublisherList } from "$lib/db/books";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	depends("customer:data");
	depends("customer:books");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { customer: null, possibleOrders: [] as CustomerOrderLine[] };
	}

	// TODO: Retirect to customers page perhaps
	const customer = (await getCustomerDetails(dbCtx.db, Number(params.id))) || ({} as Customer);
	const customerOrderLines = await getCustomerOrderLines(dbCtx.db, Number(params.id));
	const publisherList = await getPublisherList(dbCtx.db);

	return { customer, customerOrderLines, publisherList };
};

export const load: PageLoad = timed(_load);
