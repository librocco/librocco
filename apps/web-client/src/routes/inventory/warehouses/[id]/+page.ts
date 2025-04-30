import { redirect } from "@sveltejs/kit";
import { get } from "svelte/store";

import { getWarehouseById } from "$lib/db/cr-sqlite/warehouse";
import { stockByWarehouse } from "$lib/db/cr-sqlite/stock_cache";

import type { PageLoad } from "./$types";

import { getMultipleBookData, getPublisherList } from "$lib/db/cr-sqlite/books";

import { appPath } from "$lib/paths";

import { timed } from "$lib/utils/timer";
import * as stockCache from "$lib/db/cr-sqlite/stock_cache";
import type { GetStockResponseItem } from "$lib/db/cr-sqlite/types";
import { map, wrapIter } from "@librocco/shared";

const _load = async ({ parent, params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	depends("warehouse:data");
	depends("warehouse:books");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return {
			dbCtx,
			id,
			displayName: "N/A",
			discount: 0,
			publisherList: [] as string[],
			entries: new Promise<GetStockResponseItem[]>(() => {})
		};
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

	const entries = get(stockByWarehouse)
		.then((s) => s.get(id))
		.then(async (entries) => {
			const isbns = map(entries, ({ isbn }) => isbn);
			const bookData = await getMultipleBookData(dbCtx.db, ...isbns);
			const iter = wrapIter(entries)
				.zip(bookData)
				.map(([stock, bookData]) => ({ ...stock, ...bookData }));
			return [...iter];
		});

	return { dbCtx, ...warehouse, publisherList, entries };
};

export const load: PageLoad = timed(_load);
