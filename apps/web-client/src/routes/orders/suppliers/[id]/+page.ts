import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";

import { getPlacedSupplierOrders, getPublishersFor, getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";
import { resolveDbCtx } from "$lib/utils/loading";

import { appPath } from "$lib/paths";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	depends("supplier:data");
	depends("supplier:orders");

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	const id = Number(params.id);

	const supplierPromise = dbCtxPromise.then(async (ctx) => {
		if (!ctx) return null;
		const supplier = await getSupplierDetails(ctx.db, id);
		if (!supplier) {
			console.warn(`supplier with id '${params.id}' not found. redirecting to supplier list page...`);
			throw redirect(307, appPath("suppliers"));
		}
		return supplier;
	});

	const publishersDataPromise = dbCtxPromise.then(async (ctx) => {
		if (!ctx)
			return {
				assignedPublishers: [] as string[],
				publishersAssignedToOtherSuppliers: [] as string[],
				publishersUnassignedToSuppliers: [] as string[]
			};

		const [assignedPublishers, allPublishers, allAssignedPublishers] = await Promise.all([
			getPublishersFor(ctx.db, id),
			getPublisherList(ctx.db),
			getPublishersFor(ctx.db)
		]);

		const publishersAssignedToOtherSuppliers = allAssignedPublishers.filter((p) => !assignedPublishers.includes(p));
		const publishersUnassignedToSuppliers = allPublishers.filter((p) => !allAssignedPublishers.includes(p));

		return { assignedPublishers, publishersAssignedToOtherSuppliers, publishersUnassignedToSuppliers };
	});

	const ordersPromise = dbCtxPromise.then(async (ctx) => {
		if (!ctx) return [] as PlacedSupplierOrder[];
		const unreconciledOrders = (await getPlacedSupplierOrders(ctx.db, { supplierId: Number(params.id), reconciled: false })).map(
			(order) => ({ ...order, reconciled: false })
		);
		const reconciledOrders = (await getPlacedSupplierOrders(ctx.db, { supplierId: Number(params.id), reconciled: true })).map((order) => ({
			...order,
			reconciled: true
		}));
		return [...unreconciledOrders, ...reconciledOrders];
	});

	return {
		dbCtx: dbCtxPromise,
		supplier: supplierPromise,
		publishersData: publishersDataPromise,
		orders: ordersPromise
	};
};

export const load: PageLoad = timed(_load);
