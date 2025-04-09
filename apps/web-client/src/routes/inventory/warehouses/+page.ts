import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";
import { timed } from "$lib/utils/time";

import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, depends }) => {
	depends("warehouse:list");
	depends("warehouse:books");

	const { dbCtx } = await parent();

	const warehouses = dbCtx ? await timed(getAllWarehouses, dbCtx.db) : [];

	return { dbCtx, warehouses };
};
