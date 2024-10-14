import type { PageLoad } from "./$types";

import type { CustomerOrderLine } from "$lib/components/Tables/types";

export const load: PageLoad = async ({
	parent
}): Promise<Partial<{ name: string; surname: string; id: number; email: string; orderLines: CustomerOrderLine[] }>> => {
	const { db } = await parent();

	// If db is not returned (we're not in the browser environment, no need for additional loading)
	if (!db) {
		return {};
	}

	return new Promise<{ name: string; surname: string; id: number; email: string; orderLines: CustomerOrderLine[] }>((resolve) =>
		resolve({
			name: "Fadwa",
			surname: "Mahmoud",
			id: 1234,
			email: "fadwa.mahmoud@gmail.com",
			orderLines: [
				{ isbn: "9786556356", quantity: 1, title: "Book 1", authors: "Author 1", publisher: "penguin", price: 198 },
				{ isbn: "9786545357", quantity: 1, title: "Book 1", authors: "Author 2", publisher: "bloomsbury", price: 704 },
				{ isbn: "9786556358", quantity: 1, title: "Book 1", authors: "Author 3", publisher: "nahdet misr", price: 42 },
				{ isbn: "9786556859", quantity: 2, title: "Book 1", authors: "Author 5", publisher: "penguin ", price: 690 }
			]
		})
	);
};
