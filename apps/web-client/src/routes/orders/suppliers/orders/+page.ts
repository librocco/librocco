import { getAllReconciliationOrders } from "$lib/db/cr-sqlite/order-reconciliation";
import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";
import { resolveDbCtx } from "$lib/utils/loading";

import type { PlacedSupplierOrder, PossibleSupplierOrder, ReconciliationOrder } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
	depends("books:data");
	depends("suppliers:data");
	depends("customers:order_lines");
	depends("reconciliation:orders");

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	const possibleOrdersPromise = dbCtxPromise.then((ctx) => (ctx ? getPossibleSupplierOrders(ctx.db) : []));
	const placedOrdersPromise = dbCtxPromise.then((ctx) => (ctx ? getPlacedSupplierOrders(ctx.db, { reconciled: false }) : []));
	const reconcilingOrdersPromise = dbCtxPromise.then((ctx) => (ctx ? getAllReconciliationOrders(ctx.db, { finalized: false }) : []));
	const completedOrdersPromise = dbCtxPromise.then((ctx) => (ctx ? getPlacedSupplierOrders(ctx.db, { finalized: true }) : []));

	return {
		dbCtx: dbCtxPromise,
		possibleOrders: possibleOrdersPromise,
		placedOrders: placedOrdersPromise,
		reconcilingOrders: reconcilingOrdersPromise,
		completedOrders: completedOrdersPromise
	};
};

export const load: PageLoad = timed(_load);
