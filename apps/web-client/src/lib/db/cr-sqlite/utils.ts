import type { BookEntry } from "@librocco/db";

export type ProcessedOrderLine = ({ supplier_name: string } & BookEntry) & {
	delivered: boolean;
	wasOrdered: boolean;
	orderedQuantity: number;
	deliveredQuantity: number;
	remainingQuantity: number;
};
export const processOrderDelivery = (
	scannedBooks: BookEntry[],
	placedOrderLines: ({ supplier_name: string; quantity: number } & BookEntry)[]
): ProcessedOrderLine[] => {
	// Count occurrences of each ISBN in scanned books
	const scannedQuantities = scannedBooks.reduce((acc, book) => {
		acc.set(book.isbn, (acc.get(book.isbn) || 0) + 1); // Count each occurrence as 1
		return acc;
	}, new Map<string, number>());

	const placedOrderIsbnSet = new Set(placedOrderLines.map((b) => b.isbn));
	const scannedIsbnSet = new Set(scannedBooks.map((b) => b.isbn));
	const result: ProcessedOrderLine[] = [];

	for (const pol of placedOrderLines) {
		const deliveredQuantity = scannedQuantities.get(pol.isbn) || 0;
		const orderedQuantity = pol.quantity; // Assuming this is the original ordered quanti
		result.push({
			...pol,
			delivered: scannedIsbnSet.has(pol.isbn),
			wasOrdered: true,
			orderedQuantity,
			deliveredQuantity,
			remainingQuantity: Math.max(0, orderedQuantity - deliveredQuantity)
		});
	}
	// Handle extra books that weren't in the original order
	for (const isbn of scannedIsbnSet) {
		if (!placedOrderIsbnSet.has(isbn)) {
			const scannedBook = scannedBooks.find((b) => b.isbn === isbn);
			if (scannedBook) {
				result.push({
					...scannedBook,
					supplier_name: "",
					delivered: true,
					wasOrdered: false,
					orderedQuantity: 0,
					deliveredQuantity: scannedQuantities.get(isbn) || 0,
					remainingQuantity: 0
				});
			}
		}
	}

	return result;
};

export const sortLinesBySupplier = (orderLines: ProcessedOrderLine[]): { [supplier_name: string]: ProcessedOrderLine[] } => {
	return orderLines.reduce((acc, curr) => {
		return acc[curr.supplier_name]
			? { ...acc, [curr.supplier_name]: [...acc[curr.supplier_name], curr] }
			: { ...acc, [curr.supplier_name]: [curr] };
	}, {});
};
