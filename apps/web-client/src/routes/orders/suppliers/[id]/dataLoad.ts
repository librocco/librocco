import type { DBAsync, PlacedSupplierOrder, SupplierExtended } from "$lib/db/cr-sqlite/types";

import { getPublishersFor, getPublishersWithSuppliers, getPlacedSupplierOrders, getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

import type { IAppDbRx } from "$lib/app/rx";
import { reactiveDataSource as reactiveStoreDataSource } from "$lib/utils/reactive-data-source";
import { reactiveDataSource as reactiveRuneDataSource } from "$lib/utils/reactive-data-source.svelte";

export class ErrNotFound extends Error {
	constructor(msg: string) {
		super(msg);
	}
}

export type SupplierLayoutData = {
	supplier: SupplierExtended;
};

type PublisherInfo = {
	name: string;
	supplierName?: string;
};

export type SupplierOrdersViewData = {
	placedOrders: PlacedSupplierOrder[];
	reconcilingOrders: PlacedSupplierOrder[];
	completedOrders: PlacedSupplierOrder[];
};

export type SupplierPublishersViewData = {
	supplier: SupplierExtended;
	assignedPublishers: string[];
	availablePublishers: PublisherInfo[];
};

const layoutViewDeps = ["reconciliation_order", "supplier", "supplier_publisher", "supplier_order"];
const ordersViewDeps = ["reconciliation_order", "supplier_order", "supplier", "supplier_order_line", "book", "supplier_order_continuation"];
const publishersViewDeps = ["reconciliation_order", "supplier", "supplier_publisher", "supplier_order", "publisher"];

export const loadLayoutData = async (db: DBAsync, supplierId: number): Promise<SupplierLayoutData> => {
	const supplier = await getSupplierDetails(db, supplierId);

	if (!supplier) {
		throw new ErrNotFound(`supplier with id '${supplierId}' not found. redirecting to supplier list page...`);
	}

	return { supplier };
};

export const createLayoutDataStore = (rx: IAppDbRx, getDb: () => Promise<DBAsync>, supplierId: number, initialData?: SupplierLayoutData) => {
	const load = async () => loadLayoutData(await getDb(), supplierId);
	return reactiveStoreDataSource(rx, load, layoutViewDeps, initialData);
};

export const loadOrdersViewData = async (db: DBAsync, supplierId: number): Promise<SupplierOrdersViewData> => {
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

export const createOrdersViewStore = (
	rx: IAppDbRx,
	getDb: () => Promise<DBAsync>,
	supplierId: number,
	initialData?: SupplierOrdersViewData
) => {
	const load = async () => loadOrdersViewData(await getDb(), supplierId);
	return reactiveRuneDataSource(rx, load, ordersViewDeps, initialData);
};

export const loadPublishersViewData = async (db: DBAsync, supplierId: number): Promise<SupplierPublishersViewData> => {
	const supplier = await getSupplierDetails(db, supplierId);

	const [assignedPublishers, allPublishers, publishersWithSuppliers] = await Promise.all([
		getPublishersFor(db, supplierId),
		getPublisherList(db),
		getPublishersWithSuppliers(db)
	]);

	const publisherToSupplier = new Map(publishersWithSuppliers.map((publisher) => [publisher.publisher, publisher.supplier_name]));

	const availablePublishers: PublisherInfo[] = allPublishers
		.filter((publisher) => !assignedPublishers.includes(publisher))
		.map((publisher) => ({
			name: publisher,
			supplierName: publisherToSupplier.get(publisher)
		}));

	return { supplier, assignedPublishers, availablePublishers };
};

export const createPublishersViewStore = (
	rx: IAppDbRx,
	getDb: () => Promise<DBAsync>,
	supplierId: number,
	initialData?: SupplierPublishersViewData
) => {
	const load = async () => loadPublishersViewData(await getDb(), supplierId);
	return reactiveStoreDataSource(rx, load, publishersViewDeps, initialData);
};
