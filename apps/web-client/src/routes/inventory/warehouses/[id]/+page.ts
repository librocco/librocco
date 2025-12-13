import { browser } from "$app/environment";
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

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

const _load = async ({ params, depends }: Parameters<PageLoad>[0]) => {
	const id = Number(params.id);

	depends("warehouse:data");
	depends("warehouse:books");

	if (!browser) {
		return {
			id,
			displayName: "N/A",
			discount: 0,
			publisherList: [] as string[],
			entries: new Promise<GetStockResponseItem[]>(() => {})
		};
	}

	const db = await getDb(app);

	// Disable the stock cache refreshing to prevent the expensive stock query from blocking the
	// DB for other (cheaper) queries necessary for the page load.
	stockCache.disableRefresh();

	const warehouse = await getWarehouseById(db, id);
	if (!warehouse) {
		redirect(307, appPath("inventory"));
	}

	const publisherList = await getPublisherList(db);

	// Re-enable the stock cache refreshing to execute in the background
	stockCache.enableRefresh(db);

	const entries = get(stockByWarehouse)
		.then((s) => [...(s.get(id) || [])])
		.then(async (entries) => {
			// Return early if stock empty
			if (!entries.length) return [];

			const isbns = map(entries, ({ isbn }) => isbn);
			const bookData = await getMultipleBookData(db, ...isbns);
			const iter = wrapIter(entries)
				.zip(bookData)
				.map(([stock, bookData]) => ({ ...stock, ...bookData }));
			return [...iter];
		});

	return { ...warehouse, publisherList, entries };
};

export const load: PageLoad = timed(_load);
