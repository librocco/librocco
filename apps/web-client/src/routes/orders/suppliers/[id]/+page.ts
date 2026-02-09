import { browser } from "$app/environment";

import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { PlacedSupplierOrder, PossibleSupplierOrderLine } from "$lib/db/cr-sqlite/types";

import {
	getPlacedSupplierOrders,
	getPublishersFor,
	getSupplierDetails,
	getPublishersWithSuppliers,
	getPossibleSupplierOrderLines
} from "$lib/db/cr-sqlite/suppliers";

import { appPath } from "$lib/paths";
import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

type PublisherInfo = {
	name: string;
	supplierName?: string;
};

type OrderWithReconciled = PlacedSupplierOrder & { reconciled: boolean };

const _load = async ({ params, depends, parent }: Parameters<PageLoad>[0]) => {
	await parent();
	depends("supplier:data");
	depends("supplier:orders");

	const id = Number(params.id);

	if (!browser) {
		return {
			supplier: null,
			assignedPublishers: [] as string[],
			availablePublishers: [] as PublisherInfo[],
			possibleOrders: [] as PossibleSupplierOrderLine[],
			placedOrders: [] as OrderWithReconciled[],
			reconcilingOrders: [] as OrderWithReconciled[],
			completedOrders: [] as OrderWithReconciled[]
		};
	}

	const db = await getDb(app);

	const supplier = await getSupplierDetails(db, id);
	if (!supplier) {
		console.warn(`supplier with id '${params.id}' not found. redirecting to supplier list page...`);
		throw redirect(307, appPath("suppliers"));
	}

	const [assignedPublishers, allPublishers, publishersWithSuppliers] = await Promise.all([
		getPublishersFor(db, id),
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

	const possibleOrders = await getPossibleSupplierOrderLines(db, Number(params.id));
	const allPlacedOrders = await getPlacedSupplierOrders(db, { supplierId: Number(params.id) });

	const placedOrders = allPlacedOrders
		.filter((order) => order.reconciliation_order_id === null)
		.map((order) => ({ ...order, reconciled: false }));

	const reconcilingOrders = allPlacedOrders
		.filter((order) => order.reconciliation_order_id !== null && order.finalized === 0)
		.map((order) => ({ ...order, reconciled: true }));

	const completedOrders = allPlacedOrders
		.filter((order) => order.reconciliation_order_id !== null && order.finalized === 1)
		.map((order) => ({ ...order, reconciled: true }));

	return {
		supplier,
		assignedPublishers,
		availablePublishers,
		possibleOrders,
		placedOrders,
		reconcilingOrders,
		completedOrders
	};
};

export const load: PageLoad = timed(_load);
