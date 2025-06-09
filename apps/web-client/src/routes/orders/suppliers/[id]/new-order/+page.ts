import { redirect } from "@sveltejs/kit";

import { getPossibleSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";

import type { PossibleSupplierOrderLine } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";
import { appHash } from "$lib/paths";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	depends("books:data");
	depends("suppliers:data");
	depends("customers:order_lines");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { orderLines: [] as PossibleSupplierOrderLine[] };
	}

	const orderLines = await getPossibleSupplierOrderLines(dbCtx.db, parseInt(params.id));

	// TODO: when we update the routing, this will move to something like `/suppliers/[id]/new-order`
	// so if there are no possible order lines, we should redirect to `/suppliers/[id]`
	if (!orderLines.length) {
		redirect(303, appHash("suppliers"));
	}

	return { orderLines };
};

export const load: PageLoad = timed(_load);
