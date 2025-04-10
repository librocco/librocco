import { getAllWarehouses } from "$lib/db/cr-sqlite/warehouse";

import type { PageLoad } from "./$types";

import { timed } from "$lib/utils/timer";

const _load: PageLoad = async ({ parent, depends }) => {
	depends("warehouse:list");
	depends("warehouse:books");

	const { dbCtx } = await parent();

	const warehouses = dbCtx ? await getAllWarehouses(dbCtx.db) : [];

	return { dbCtx, warehouses };
};

export const load = timed(_load as any) as PageLoad;
