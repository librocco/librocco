import { redirect } from "@sveltejs/kit";
import { get } from "svelte/store";
import { resolveDbCtx } from "$lib/utils/loading";

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

	const { dbCtx: dbCtxOrPromise } = await parent();

	const dbCtxPromise = resolveDbCtx(dbCtxOrPromise);

	const warehouseDataPromise = dbCtxPromise.then(async (ctx) => {
		if (!ctx) {
			return {
				id,
				displayName: "N/A",
				discount: 0,
				publisherList: [] as string[]
			};
		}

		// Disable the stock cache refreshing to prevent the expensive stock query from blocking the
		// DB for other (cheaper) queries necessary for the page load.
		stockCache.disableRefresh();

		const warehouse = await getWarehouseById(ctx.db, id);
		if (!warehouse) {
			redirect(307, appPath("inventory"));
		}

		const publisherList = await getPublisherList(ctx.db);

		// Re-enable the stock cache refreshing to execute in the background
		stockCache.enableRefresh(ctx.db);

		return { ...warehouse, publisherList };
	});

	const entriesPromise = get(stockByWarehouse)
		.then((s) => [...(s.get(id) || [])])
		.then(async (entries) => {
			// Return early if stock empty
			if (!entries.length) return [];

			// We need dbCtx to fetch book data
			const ctx = await dbCtxPromise;
			if (!ctx) return [];

			const isbns = map(entries, ({ isbn }) => isbn);
			const bookData = await getMultipleBookData(ctx.db, ...isbns);
			const iter = wrapIter(entries)
				.zip(bookData)
				.map(([stock, bookData]) => ({ ...stock, ...bookData }));
			return [...iter];
		});

	return { dbCtx: dbCtxPromise, warehouseData: warehouseDataPromise, entries: entriesPromise };
};

export const load: PageLoad = timed(_load);
