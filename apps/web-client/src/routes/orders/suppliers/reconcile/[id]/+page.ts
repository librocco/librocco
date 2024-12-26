import { getReconciliationOrder } from "$lib/db/cr-sqlite/order-reconciliation";
import type { BookEntry } from "@librocco/db";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("reconciliationOrder:data");

	const { ordersDb, dbCtx } = await parent();
	const reconciliationOrder = await getReconciliationOrder(ordersDb, parseInt(params.id));

	const books: string[] = JSON.parse(reconciliationOrder.customer_order_line_ids) || [];
	let mergedBookData = [];
	if (books.length) {
		const bookData = await ordersDb.execO<BookEntry>(`SELECT *
	FROM book WHERE isbn IN (${books.join(", ")})`);

		mergedBookData = books.map((book) => {
			return bookData.find((bookD) => bookD.isbn === book) || { isbn: book };
		});
	}

	return { reconciliationOrder, ordersDb, mergedBookData, dbCtx };
};

export const ssr = false;
