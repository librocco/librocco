import { browser } from "$app/environment";

import type { PageLoad } from "./$types";
import type { GetStockResponseItem, PastTransactionItem } from "$lib/db/cr-sqlite/types";

import { getPastTransactions } from "$lib/db/cr-sqlite/history";
import { getStock } from "$lib/db/cr-sqlite/stock";
import { getBookData } from "$lib/db/cr-sqlite/books";

export const load: PageLoad = async ({ params: { isbn }, parent, depends }) => {
	depends("history:transactions");

	const { dbCtx } = await parent();

	if (!browser) {
		return { dbCtx, transactions: [] as PastTransactionItem[], stock: [] as GetStockResponseItem[] };
	}

	const transactions = await getPastTransactions(dbCtx.db, { isbn });
	const bookData = await getBookData(dbCtx.db, isbn);
	const stock = await getStock(dbCtx.db, { isbns: [isbn] });

	return { dbCtx, transactions, bookData, stock };
};
