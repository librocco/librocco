import type { DBAsync, SupplierExtended } from "$lib/db/cr-sqlite/types";

import { getPublishersFor, getPublishersWithSuppliers, getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";

import { getPublisherList } from "$lib/db/cr-sqlite/books";
import type { IAppDbRx } from "$lib/app/rx";
import { reactiveDataSource } from "$lib/utils/reactive-data-source";

type PublisherInfo = {
	name: string;
	supplierName?: string;
};

export type SupplierPublishersPageData = {
	supplier: SupplierExtended;
	assignedPublishers: string[];
	availablePublishers: PublisherInfo[];
};

const publisherViewDeps = ["reconciliation_order", "supplier", "supplier_publisher", "supplier_order", "publisher"];

export const loadData = async (db: DBAsync, supplierId: number): Promise<SupplierPublishersPageData> => {
	const supplier = await getSupplierDetails(db, supplierId);

	const [assignedPublishers, allPublishers, publishersWithSuppliers] = await Promise.all([
		getPublishersFor(db, supplierId),
		getPublisherList(db),
		getPublishersWithSuppliers(db)
	]);

	const publisherToSupplier = new Map(publishersWithSuppliers.map((p) => [p.publisher, p.supplier_name]));

	const availablePublishers: PublisherInfo[] = allPublishers
		.filter((pub) => !assignedPublishers.includes(pub))
		.map((pub) => ({
			name: pub,
			supplierName: publisherToSupplier.get(pub)
		}));

	return { supplier, assignedPublishers, availablePublishers };
};

export const createDataStore = (
	rx: IAppDbRx,
	getDb: () => Promise<DBAsync>,
	supplierId: number,
	initialData?: SupplierPublishersPageData
) => {
	const load = async () => loadData(await getDb(), supplierId);
	return reactiveDataSource(rx, load, publisherViewDeps, initialData);
};
