import type { LayoutLoad } from "./$types";

import { getInitializedDB } from "$lib/db/cr-sqlite";
import { getAllCustomers, getAllCustomerOrderLines } from "$lib/db/cr-sqlite/customers";
import { dbNamePersisted } from "$lib/db";
import { get } from "svelte/store";

export const load: LayoutLoad = async ({ depends }) => {
	depends("customer:data");
	depends("customer:books");

	const name = get(dbNamePersisted);

	const dbCtx = await getInitializedDB(name);
	const { db } = dbCtx;

	const customers = await getAllCustomers(db);

	const customerOrderLines = await getAllCustomerOrderLines(db);

	// TODO: we could rename this to 'dbCtx' once the same approach is used in inventory db
	return { ordersDbCtx: dbCtx, customers, customerOrderLines };
};

export const ssr = false;
