import { getPossibleOrderLinesForSupplier } from "$lib/db/orders/suppliers";
import type { BookEntry } from "@librocco/db";
import type { PageLoad } from "./$types";
export const load: PageLoad = async ({ parent, params }) => {
	const { ordersDb } = await parent();

	const lines = await getPossibleOrderLinesForSupplier(ordersDb, parseInt(params.id));
	const isbns = lines.map((book) => book.isbn);
	const bookData = (await ordersDb.execO(`SELECT * FROM book WHERE isbn IN (${isbns.join(", ")})`)) as BookEntry[];

	const bookDataMap = new Map<string, BookEntry>();
	bookData.forEach((book) => {
		bookDataMap.set(book.isbn, book);
	});

	const supplierOrderLinesWithData = lines.map((line) => ({ ...line, ...bookDataMap.get(line.isbn) }));
	return { lines, books: supplierOrderLinesWithData, bookDataMap };
};
export const ssr = false;
