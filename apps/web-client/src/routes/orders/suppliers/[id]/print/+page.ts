import type { PageLoad } from "./$types";
import { getPlacedSupplierOrders, getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";
import { timed } from "$lib/utils/timer";
import type { PlacedSupplierOrder, Supplier } from "$lib/db/cr-sqlite/types";
import { redirect } from "@sveltejs/kit";
import { appPath } from "$lib/paths";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	depends("supplier:data");
	depends("supplier:orders");

	const { dbCtx } = await parent();

	if (!dbCtx) {
		return { supplier: null, orders: [] as PlacedSupplierOrder[] };
	}

	const supplierId = Number(params.id);
	const supplier = await getSupplierDetails(dbCtx.db, supplierId);

	if (!supplier) {
		// Or handle error appropriately for print view
		console.warn(`Supplier with id '${params.id}' not found for print. Redirecting...`);
		redirect(307, appPath("suppliers"));
	}

	// Fetch both unreconciled and reconciled orders for printing
	const unreconciledOrders = await getPlacedSupplierOrders(dbCtx.db, { supplierId, reconciled: false });
	const reconciledOrders = await getPlacedSupplierOrders(dbCtx.db, { supplierId, reconciled: true });

	const orders = [...unreconciledOrders, ...reconciledOrders].map((o) => ({ ...o, lines: o.lines || [] }));

	return { supplier, orders };
};

export const load: PageLoad = timed(_load);
