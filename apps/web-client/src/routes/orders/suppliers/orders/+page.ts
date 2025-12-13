import { browser } from "$app/environment";

import { getAllReconciliationOrders } from "$lib/db/cr-sqlite/order-reconciliation";
import { getPlacedSupplierOrders, getPossibleSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { PlacedSupplierOrder, PossibleSupplierOrder, ReconciliationOrder } from "$lib/db/cr-sqlite/types";
import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ depends, parent }: Parameters<PageLoad>[0]) => {
	await parent();
	depends("books:data");
	depends("suppliers:data");
	depends("customers:order_lines");
	depends("reconciliation:orders");

	if (!browser) {
		return {
			possibleOrders: [] as PossibleSupplierOrder[],
			placedOrders: [] as PlacedSupplierOrder[],
			reconcilingOrders: [] as ReconciliationOrder[],
			completedOrders: [] as PlacedSupplierOrder[]
		};
	}

	const db = await getDb(app);

	const possibleOrders = await getPossibleSupplierOrders(db);
	const placedOrders = await getPlacedSupplierOrders(db, { reconciled: false });
	const reconcilingOrders = await getAllReconciliationOrders(db, { finalized: false });
	const completedOrders = await getPlacedSupplierOrders(db, { finalized: true });

	return { possibleOrders, placedOrders, reconcilingOrders, completedOrders };
};

export const load: PageLoad = timed(_load);
