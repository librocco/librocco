import type { PageLoad } from "./$types";
import { getCustomerBooks, getCustomerDetails } from "$lib/db/cr-sqlite/customers";
import type { Customer } from "$lib/db/cr-sqlite/types";
import type { BookEntry } from "@librocco/db";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("customer:data");
	depends("customer:books");

	const data = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!data?.ordersDbCtx?.db) {
		return {};
	}

	const { db } = data.ordersDbCtx;

	const customerDetails = await getCustomerDetails(db, Number(params.id));

	// TODO: make this a single query
	const customerOrderLines = await getCustomerBooks(db, Number(params.id));
	const isbns = customerOrderLines.map((book) => book.isbn);
	const bookData = (await db.execO(`SELECT * FROM book WHERE isbn IN (${isbns.join(", ")})`)) as BookEntry[];
	const bookDataMap = new Map<string, BookEntry>();
	bookData.forEach((book) => {
		bookDataMap.set(book.isbn, book);
	});

	return { books: bookData, customer: customerDetails[0] || ({} as Customer), customerOrderLines };
};
