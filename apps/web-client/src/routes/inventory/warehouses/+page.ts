import { browser } from "$app/environment";
import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";
import type { Warehouse } from "$lib/db/cr-sqlite/types";

import * as stockCache from "$lib/db/cr-sqlite/stock_cache";

import { timed } from "$lib/utils/timer";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ depends }: Parameters<PageLoad>[0]) => {
	depends("warehouse:list");
	depends("warehouse:books");

	// Disable the stock cache refreshing to prevent the expensive stock query from blocking the
	// DB for other (cheaper) queries necessary for the page load.
	stockCache.disableRefresh();

	if (!browser) {
		return { warehouses: [] as Warehouse[] };
	}

	const db = await getDb(app);

	const warehouses = await getAllWarehouses(db, { skipTotals: true });

	// Re-enable the stock cache refreshing to execute in the background
	stockCache.enableRefresh(db);

	return { warehouses };
};

export const load: PageLoad = timed(_load);
