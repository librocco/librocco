import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load = async ({ parent, depends }: Parameters<PageLoad>[0]) => {
	depends("warehouse:list");
	depends("warehouse:books");

	const { dbCtx } = await parent();

	const warehouses = dbCtx ? await getAllWarehouses(dbCtx.db) : [];

	return { dbCtx, warehouses };
};

export const load: PageLoad = timed(_load);
