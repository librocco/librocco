import { browser } from "$app/environment";

import { app } from "$lib/app";
import { getDb } from "$lib/app/db";

import type { PageLoad } from "./$types";
import type { GetStockResponseItem, PastTransactionItem } from "$lib/db/cr-sqlite/types";

import { getPastTransactions } from "$lib/db/cr-sqlite/history";
import { getStock } from "$lib/db/cr-sqlite/stock";
import { getBookData } from "$lib/db/cr-sqlite/books";

import { timed } from "$lib/utils/timer";

const _load = async ({ params: { isbn }, parent, depends }: Parameters<PageLoad>[0]) => {
	await parent();
	depends("history:transactions");

	if (!browser) {
		return { transactions: [] as PastTransactionItem[], stock: [] as GetStockResponseItem[] };
	}

	const db = await getDb(app);

	const transactions = await getPastTransactions(db, { isbn });
	const bookData = await getBookData(db, isbn);
	const stock = await getStock(db, { isbns: [isbn] });

	return { transactions, bookData, stock };
};

export const load: PageLoad = timed(_load);
