import type { DBAsync, SupplierExtended } from "$lib/db/cr-sqlite/types";

import { getSupplierDetails } from "$lib/db/cr-sqlite/suppliers";

import type { IAppDbRx } from "$lib/app/rx";
import { reactiveDataSource } from "$lib/utils/reactive-data-source";

export class ErrNotFound extends Error {
	constructor(msg: string) {
		super(msg);
	}
}

export type SupplierLayoutData = {
	supplier: SupplierExtended;
};

const tableDeps = ["reconciliation_order", "supplier", "supplier_publisher", "supplier_order"];

export const loadData = async (db: DBAsync, supplierId: number): Promise<SupplierLayoutData> => {
	const supplier = await getSupplierDetails(db, supplierId);

	if (!supplier) {
		throw new ErrNotFound(`supplier with id '${supplierId}' not found. redirecting to supplier list page...`);
	}

	return { supplier };
};

export const createDataStore = (rx: IAppDbRx, getDb: () => Promise<DBAsync>, supplierId: number, initialData?: SupplierLayoutData) => {
	const load = async () => loadData(await getDb(), supplierId);
	return reactiveDataSource(rx, load, tableDeps, initialData);
};
