import { browser } from "$app/environment";
import { redirect } from "@sveltejs/kit";

import { getPossibleSupplierOrderLines, getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";

import type { PossibleSupplierOrderLine } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";
import { appHash } from "$lib/paths";

import { app, getDb } from "$lib/app";

const _load = async ({ params, depends }: Parameters<PageLoad>[0]) => {
	depends("books:data");
	depends("suppliers:data");
	depends("customers:order_lines");

	if (!browser) {
		return { orderLines: [] as PossibleSupplierOrderLine[] };
	}

	const db = await getDb(app);

	// Handle "null" string parameter for General supplier
	const supplierId = params.id === "null" ? null : parseInt(params.id);

	const orderLines = await getPossibleSupplierOrderLines(db, supplierId);

	const supplier = await getSupplierDetails(db, supplierId);

	// TODO: when we update the routing, this will move to something like `/suppliers/[id]/new-order`
	// so if there are no possible order lines, we should redirect to `/suppliers/[id]`
	if (!orderLines.length) {
		redirect(303, appHash("suppliers"));
	}

	return { orderLines, supplier };
};

export const load: PageLoad = timed(_load);
