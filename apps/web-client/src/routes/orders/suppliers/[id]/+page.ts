import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { PlacedSupplierOrder, Supplier } from "$lib/db/cr-sqlite/types";

import { getPlacedSupplierOrders, getPublishersFor, getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";

import { appPath } from "$lib/paths";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("supplier:data");
	depends("supplier:orders");

	const { dbCtx } = await parent();

	// We're not in browser, no need for further processing
	if (!dbCtx) {
		return {
			supplier: {} as Supplier,
			assignedPublishers: [] as string[],
			unassignedPublishers: [] as string[],
			orders: [] as PlacedSupplierOrder[]
		};
	}

	const id = Number(params.id);

	const supplier = await getSupplierDetails(dbCtx.db, id);
	if (!supplier) {
		console.warn(`supplier with id '${params.id}' not found. redirecting to supplier list page...`);
		throw redirect(307, appPath("suppliers"));
	}

	const [assignedPublishers, allPublishers] = await Promise.all([getPublishersFor(dbCtx.db, id), getPublisherList(dbCtx.db)]);

	// NOTE: the list of unassigned publishers will contain all publishers not assigned to the supplier
	// TODO: check if this is the desired behavior, or if we should only list publishers that are not assigned to any supplier
	const unassignedPublishers = allPublishers.filter((p) => !assignedPublishers.includes(p));

	const orders = await getPlacedSupplierOrders(dbCtx.db, Number(params.id));

	return { supplier, assignedPublishers, unassignedPublishers, orders };
};
