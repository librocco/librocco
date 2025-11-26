import type { PageLoad } from "./$types";
import type { GetStockResponseItem, PastTransactionItem } from "$lib/db/cr-sqlite/types";

import { getPastTransactions } from "$lib/db/cr-sqlite/history";
import { getStock } from "$lib/db/cr-sqlite/stock";
import { getBookData } from "$lib/db/cr-sqlite/books";

import { timed } from "$lib/utils/timer";

const _load = async ({ params: { isbn }, parent, depends }: Parameters<PageLoad>[0]) => {
	depends("history:transactions");

	const { dbCtx: dbCtxOrPromise } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtxOrPromise) {
		return { transactions: [] as PastTransactionItem[], stock: [] as GetStockResponseItem[] };
	}

	// Await the dbCtx promise if it's a promise
	const dbCtx = await dbCtxOrPromise;

	const transactions = await getPastTransactions(dbCtx.db, { isbn });
	const bookData = await getBookData(dbCtx.db, isbn);
	const stock = await getStock(dbCtx.db, { isbns: [isbn] });

	return { dbCtx, transactions, bookData, stock };
};

export const load: PageLoad = timed(_load);
