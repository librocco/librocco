import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";
import type { Warehouse } from "$lib/db/cr-sqlite/types";

import { timed } from "$lib/utils/timer";
import * as stockCache from "$lib/db/cr-sqlite/stock_cache";

const _load = async ({ parent, depends }: Parameters<PageLoad>[0]) => {
	depends("warehouse:list");
	depends("warehouse:books");

	// Disable the stock cache to prevent the expensive stock query from blocking the
	// DB for other (cheaper) queries necessary for the page load.
	stockCache.disable();

	const { dbCtx } = await parent();
	if (!dbCtx) return { dbCtx, warehouses: [] as Warehouse[] };

	const warehouses = await getAllWarehouses(dbCtx.db, { skipTotals: true });

	// Enable the stock cache again to execute in the background
	stockCache.enable(dbCtx.db);

	return { dbCtx, warehouses };
};

export const load: PageLoad = timed(_load);
