import type { PlacedSupplierOrderLine } from "$lib/db/types";
import { extractBookData } from "$lib/utils/misc";
import type { BookData } from "@librocco/shared";

export type ReconciliationUnmatchedBookLine = BookData & {
	orderedQuantity: number;
	deliveredQuantity: number;
};

export type ReconciliationProcessedLine = BookData & {
	supplier_id: number;
	supplier_name: string;

	orderedQuantity: number;
	deliveredQuantity: number;
};

/**
* Processes delivered books against placed order lines to identify matches an
discrepancies
*
* @param scannedBooks - Array of scanned books with their quantities
* @param placedOrderLines - Array of originally placed order lines from
supplier
*
* @returns Object containing:
*  - processedLines: Array of matched books with both ordered and delivered
quantities
*  - unmatchedBooks: Array of books that either:
*    - Were ordered but not delivered
*    - Were delivered but not in original order
*/
export const processOrderDelivery = (
	scannedBooks: (BookData & { quantity: number })[],
	placedOrderLines: PlacedSupplierOrderLine[]
): { processedLines: ReconciliationProcessedLine[]; unmatchedBooks: ReconciliationUnmatchedBookLine[] } => {
	const unmatchedBooks: ReconciliationUnmatchedBookLine[] = [];
	const processedLines: ReconciliationProcessedLine[] = [];

	// Create a map of scanned books for quick lookup
	const scannedBooksMap = new Map(scannedBooks.map((b) => [b.isbn, b]));

	// Process each placed order line
	for (const placedOrderLine of placedOrderLines) {
		const scannedBook = scannedBooksMap.get(placedOrderLine.isbn);

		if (scannedBook) {
			// Calculate delivered quantity
			const deliveredQuantity = Math.min(scannedBook.quantity, placedOrderLine.quantity);

			// Add to processed lines
			processedLines.push({
				...extractBookData(placedOrderLine),
				supplier_id: placedOrderLine.supplier_id,
				supplier_name: placedOrderLine.supplier_name,
				deliveredQuantity,
				orderedQuantity: placedOrderLine.quantity
			});

			// Update the remaining quantity in the scanned book
			const remainingQuantity = scannedBook.quantity - deliveredQuantity;
			if (remainingQuantity > 0) {
				scannedBooksMap.set(scannedBook.isbn, { ...scannedBook, quantity: remainingQuantity });
			} else {
				scannedBooksMap.delete(scannedBook.isbn);
			}
		} else {
			// If no matching scanned book, add to processed lines with deliveredQuantity = 0
			processedLines.push({
				...extractBookData(placedOrderLine),
				supplier_id: placedOrderLine.supplier_id,
				supplier_name: placedOrderLine.supplier_name,
				deliveredQuantity: 0,
				orderedQuantity: placedOrderLine.quantity
			});
		}
	}

	// Add remaining scanned books to unmatchedBooks
	unmatchedBooks.push(
		...Array.from(scannedBooksMap.values()).map((b) => ({
			...extractBookData(b),
			deliveredQuantity: b.quantity,
			orderedQuantity: 0
		}))
	);

	return { processedLines, unmatchedBooks };
};
