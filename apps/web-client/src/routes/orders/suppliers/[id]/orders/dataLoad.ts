import type { DBAsync, PlacedSupplierOrder } from "$lib/db/cr-sqlite/types";

import { getPlacedSupplierOrders } from "$lib/db/cr-sqlite/suppliers";

import type { IAppDbRx } from "$lib/app/rx";
import { reactiveDataSource } from "$lib/utils/reactive-data-source";

export type SupplierOrdersPageData = {
	placedOrders: PlacedSupplierOrder[];
	reconcilingOrders: PlacedSupplierOrder[];
	completedOrders: PlacedSupplierOrder[];
};

const ordersViewDeps = ["reconciliation_order", "supplier_order", "supplier", "supplier_order_line", "book", "supplier_order_continuation"];

export const loadData = async (db: DBAsync, supplierId: number): Promise<SupplierOrdersPageData> => {
	const allPlacedOrders = await getPlacedSupplierOrders(db, { supplierId });

	const placedOrders: PlacedSupplierOrder[] = [];
	const reconcilingOrders: PlacedSupplierOrder[] = [];
	const completedOrders: PlacedSupplierOrder[] = [];
	for (const order of allPlacedOrders) {
		if (order.finalized) {
			completedOrders.push(order);
			continue;
		}

		if (order.reconciliation_order_id) {
			reconcilingOrders.push(order);
			continue;
		}

		placedOrders.push(order);
	}

	return { placedOrders, reconcilingOrders, completedOrders };
};

export const createDataStore = (rx: IAppDbRx, getDb: () => Promise<DBAsync>, supplierId: number, initialData?: SupplierOrdersPageData) => {
	const load = async () => loadData(await getDb(), supplierId);
	return reactiveDataSource(rx, load, ordersViewDeps, initialData);
};
