import { redirect } from "@sveltejs/kit";

import { getPossibleSupplierOrderLines, getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";

import type { PossibleSupplierOrderLine } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";
import { appHash } from "$lib/paths";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	depends("books:data");
	depends("suppliers:data");
	depends("customers:order_lines");

	const { dbCtx: dbCtxOrPromise } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtxOrPromise) {
		return { orderLines: [] as PossibleSupplierOrderLine[] };
	}

	// Await the dbCtx promise if it's a promise
	const dbCtx = await dbCtxOrPromise;

	// Handle "null" string parameter for General supplier
	const supplierId = params.id === "null" ? null : parseInt(params.id);

	const orderLines = await getPossibleSupplierOrderLines(dbCtx.db, supplierId);

	const supplier = await getSupplierDetails(dbCtx.db, supplierId);

	// TODO: when we update the routing, this will move to something like `/suppliers/[id]/new-order`
	// so if there are no possible order lines, we should redirect to `/suppliers/[id]`
	if (!orderLines.length) {
		redirect(303, appHash("suppliers"));
	}

	return { dbCtx, orderLines, supplier };
};

export const load: PageLoad = timed(_load);
