import { getPlacedSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";

import type { PlacedSupplierOrderLine } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, params }) => {
	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return { orderLines: [] as PlacedSupplierOrderLine[] };
	}

	const orderLines = await getPlacedSupplierOrderLines(dbCtx.db, [parseInt(params.id)]);

	return { orderLines };
};

export const ssr = false;
