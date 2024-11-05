import type { PageLoad } from "./$types";
import { currentCustomer } from "$lib/stores/orders";
import { getCustomerBooks, getCustomerDetails } from "$lib/db/orders/customers";
import type { Customer } from "$lib/db/orders/types";
import type { BookEntry } from "@librocco/db";

export const load: PageLoad = async ({ parent, params }) => {
	const { ordersDb } = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!ordersDb) {
		return {};
	}

	const customerBooks = await getCustomerBooks(ordersDb, Number(params.id));

	const customerDetails = await getCustomerDetails(ordersDb, Number(params.id));

	const isbns = customerBooks.map((book) => book.isbn);

	const bookData = (await ordersDb.execO(`SELECT * FROM book WHERE isbn IN (${isbns.join(", ")})`)) as BookEntry[];

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

	// merge book data with customerBooks
	currentCustomer.update((prev) =>
		prev && prev.customerDetails.id === customerDetails[0].id
			? { ...prev, customerBooks: mergedBooks }
			: { customerBooks: mergedBooks, customerDetails: customerDetails[0] }
	);

	return { customerBooks: mergedBooks, customerDetails: customerDetails[0] || ({} as Customer) };
};
