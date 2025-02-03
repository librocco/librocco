import { getPossibleSupplierOrderLines } from "$lib/db/cr-sqlite/suppliers";
import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { base } from "$app/paths";

export const load: PageLoad = async ({ parent, params }) => {
	const { ordersDb } = await parent();

	const orderLines = await getPossibleSupplierOrderLines(ordersDb, parseInt(params.id));

	// TODO: when we update the routing, this will move to something like `/suppliers/[id]/new-order`
	// so if there are no possible order lines, we should redirect to `/suppliers/[id]`
	if (!orderLines.length) {
		redirect(303, `${base}/orders/suppliers`);
	}

	return { orderLines };
};

export const ssr = false;
