import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";
import { resolveDbCtx } from "$lib/utils/loading";

import type { PageLoad } from "./$types";
import type { Warehouse } from "$lib/db/cr-sqlite/types";

import * as stockCache from "$lib/db/cr-sqlite/stock_cache";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, depends }: Parameters<PageLoad>[0]) => {
	depends("warehouse:list");
	depends("warehouse:books");

	// Disable the stock cache refreshing to prevent the expensive stock query from blocking the
	// DB for other (cheaper) queries necessary for the page load.
	stockCache.disableRefresh();

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	const warehousesPromise = dbCtxPromise.then((ctx) => {
		if (!ctx) return [];
		const warehouses = getAllWarehouses(ctx.db, { skipTotals: true });
		// Re-enable the stock cache refreshing to execute in the background
		stockCache.enableRefresh(ctx.db);
		return warehouses;
	});

	return { dbCtx: dbCtxPromise, warehouses: warehousesPromise };
};

export const load: PageLoad = timed(_load);
