import type { PageLoad } from "./$types";
import { getCustomerBooks, getCustomerDetails } from "$lib/db/orders/customers";
import type { Customer } from "$lib/db/orders/types";
import type { BookEntry } from "@librocco/db";

export const load: PageLoad = async ({ parent, params, depends }) => {
	depends("customer:data");
	depends("customer:books");

	const { dbCtx } = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!dbCtx) {
		return {};
	}

	const customerDetails = await getCustomerDetails(dbCtx.db, Number(params.id));

	// TODO: make this a single query
	const customerBooks = await getCustomerBooks(dbCtx.db, Number(params.id));
	const isbns = customerBooks.map((book) => book.isbn);
	const bookData = (await dbCtx.db.execO(`SELECT * FROM book WHERE isbn IN (${isbns.join(", ")})`)) as BookEntry[];
	const bookDataMap = new Map<string, BookEntry>();
	bookData.forEach((book) => {
		bookDataMap.set(book.isbn, book);
	});
	const mergedBooks = customerBooks.map((customerBook) => {
		const additionalData = bookDataMap.get(customerBook.isbn) || ({} as BookEntry);
		return {
			...customerBook,
			...additionalData
		};
	});

	return { customerBooks: mergedBooks, customerDetails: customerDetails[0] || ({} as Customer) };
};
