import type { PageLoad } from "./$types";

import type { Customer, CustomerOrderLine } from "$lib/db/cr-sqlite/types";
import { getCustomerDetails, getCustomerOrderLines } from "$lib/db/cr-sqlite/customers";

import { timed } from "$lib/utils/timer";
import { redirect } from "@sveltejs/kit";
import { appPath } from "$lib/paths";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	// Add dependencies if they were relevant in the original or might be for print
	depends("customer:data"); // For customer details
	depends("customer:books"); // For order lines

	const { dbCtx } = await parent();

	// If no dbCtx (e.g., not in browser or DB not initialized), return minimal data.
	// This follows the pattern of the original file.
	if (!dbCtx) {
		return {
			id,
			customer: null,
			customerOrderLines: [] as CustomerOrderLine[]
		};
	}

	const customer = await getCustomerDetails(dbCtx.db, id);

	if (!customer) {
		// Redirect if customer not found, e.g., to a general orders page or an error page
		// Using a generic path for now.
		redirect(307, appPath("orders/customers"));
	}

	const customerOrderLines = await getCustomerOrderLines(dbCtx.db, id);

	return { id, customer, customerOrderLines };
};

export const load: PageLoad = timed(_load);
