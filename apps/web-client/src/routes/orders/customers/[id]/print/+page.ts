import type { PageLoad } from "./$types";
import { getCustomerOrderLines, getCustomerDetails } from "$lib/db/cr-sqlite/customers";
import { timed } from "$lib/utils/timer";
import type { Customer, CustomerOrderLine } from "$lib/db/cr-sqlite/types";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	depends("customer:data");
	depends("customer:books");

	const { dbCtx } = await parent();

	if (!dbCtx) {
		return { customer: null, customerOrderLines: [] as CustomerOrderLine[] };
	}

	const customerId = Number(params.id);
	const customer = (await getCustomerDetails(dbCtx.db, customerId)) || null;
	const customerOrderLines = await getCustomerOrderLines(dbCtx.db, customerId);

	return { customer, customerOrderLines };
};

export const load: PageLoad = timed(_load);
