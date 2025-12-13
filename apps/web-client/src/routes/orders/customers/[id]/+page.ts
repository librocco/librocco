import { browser } from "$app/environment";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

import type { PageLoad } from "./$types";

import type { Customer, CustomerOrderLine } from "$lib/db/cr-sqlite/types";

import { getCustomerOrderLines, getCustomerDetails } from "$lib/db/cr-sqlite/customers";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { timed } from "$lib/utils/timer";

const _load = async ({ params, depends, parent }: Parameters<PageLoad>[0]) => {
	await parent();
	depends("customer:data");
	depends("customer:books");

	if (!browser) {
		return { customer: null, possibleOrders: [] as CustomerOrderLine[] };
	}

	const db = await getDb(app);

	// TODO: Retirect to customers page perhaps
	const customer = (await getCustomerDetails(db, Number(params.id))) || ({} as Customer);
	const customerOrderLines = await getCustomerOrderLines(db, Number(params.id));
	const publisherList = await getPublisherList(db);

	return { customer, customerOrderLines, publisherList };
};

export const load: PageLoad = timed(_load);
