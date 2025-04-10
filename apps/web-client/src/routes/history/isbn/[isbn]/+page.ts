import type { PageLoad } from "./$types";
import type { GetStockResponseItem, PastTransactionItem } from "$lib/db/cr-sqlite/types";

import { getPastTransactions } from "$lib/db/cr-sqlite/history";
import { getStock } from "$lib/db/cr-sqlite/stock";
import { getBookData } from "$lib/db/cr-sqlite/books";

import { timed } from "$lib/utils/timer";

const _load: PageLoad = async ({ params: { isbn }, parent, depends }) => {
	depends("history:transactions");

	const { dbCtx } = await parent();

	// We're not in the browser, no need for further loading
	if (!dbCtx) {
		return { transactions: [] as PastTransactionItem[], stock: [] as GetStockResponseItem[] };
	}

	const transactions = await getPastTransactions(dbCtx.db, { isbn });
	const bookData = await getBookData(dbCtx.db, isbn);
	const stock = await getStock(dbCtx.db, { isbns: [isbn] });

	return { dbCtx, transactions, bookData, stock };
};

export const load = timed(_load as any) as PageLoad;
