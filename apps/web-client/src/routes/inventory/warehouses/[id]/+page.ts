import { getStock } from "$lib/db/cr-sqlite/stock";
import { getWarehouseById } from "$lib/db/cr-sqlite/warehouse";
import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import { getPublisherList } from "$lib/db/cr-sqlite/books";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";
import * as stockCache from "$lib/db/cr-sqlite/stock_cache";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	depends("warehouse:data");
	depends("warehouse:books");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { dbCtx, id, displayName: "N/A", discount: 0, publisherList: [] as string[] };
	}

	// Disable the stock cache to prevent the expensive stock query from blocking the
	// DB for other (cheaper) queries necessary for the page load.
	stockCache.disable();

	const warehouse = await getWarehouseById(dbCtx.db, id);
	if (!warehouse) {
		redirect(307, appPath("inventory"));
	}

	const publisherList = await getPublisherList(dbCtx.db);

	// Enable the stock cache again to execute in the background
	stockCache.enable(dbCtx.db);

	return { dbCtx, ...warehouse, publisherList };
};

export const load: PageLoad = timed(_load);
